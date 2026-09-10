#!/usr/bin/env node
/**
 * FRAU FITNESS — автопубликация статей блога.
 *
 * Берёт следующую статью из _queue/, переносит её в blog/,
 * добавляет запись в blog/articles.json и строку в sitemap.xml.
 *
 * Порядок публикации:
 *   1) _queue/schedule.json, если он есть;
 *   2) иначе — файлы _queue/*.html по алфавиту.
 *
 * schedule.json понимается в любом из видов:
 *   ["stat-1.html", "stat-2.html", ...]
 *   [{"file":"stat-1.html","title":"...","excerpt":"...","tag":"Питание"}, ...]
 *   {"queue":[...]} | {"articles":[...]} | {"schedule":[...]} | {"order":[...]}
 * Недостающие поля берутся из самой HTML-страницы.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const QUEUE_DIR = path.join(ROOT, '_queue');
const BLOG_DIR = path.join(ROOT, 'blog');
const ARTICLES_JSON = path.join(BLOG_DIR, 'articles.json');
const SITEMAP = path.join(ROOT, 'sitemap.xml');

const SITE = 'https://fraufitness.ru';
const TZ = 'Europe/Astrakhan';
const DEFAULT_TAG = 'Тренировки';
const KNOWN_TAGS = ['Мотивация', 'Тренировки', 'Похудение', 'Здоровье', 'Питание', 'Beauty'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/* ------------------------------------------------------------------ дата */

function todayISO() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  } catch (e) {
    const d = new Date(Date.now() + 4 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }
}

function displayDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/* ------------------------------------------------------- вспомогательное */

function fail(message) {
  console.error('ОШИБКА: ' + message);
  process.exit(1);
}

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  const delimiter = 'EOF_' + Math.random().toString(36).slice(2);
  fs.appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------------------------------------------------------------- очередь */

function normalizeEntry(entry) {
  if (typeof entry === 'string') {
    const base = path.basename(entry.trim());
    if (!base) return null;
    return { file: base.endsWith('.html') ? base : base + '.html' };
  }
  if (!entry || typeof entry !== 'object') return null;

  const rawFile = entry.file || entry.filename || entry.fileName || entry.path ||
                  entry.name || (entry.slug ? entry.slug + '.html' : null);
  if (!rawFile) return null;

  const base = path.basename(String(rawFile).trim());
  return {
    file: base.endsWith('.html') ? base : base + '.html',
    title: entry.title || entry.name || null,
    excerpt: entry.excerpt || entry.description || entry.desc || null,
    tag: entry.tag || entry.category || entry.rubric || entry.section || entry.topic || null
  };
}

function readSchedule() {
  const file = path.join(QUEUE_DIR, 'schedule.json');
  if (!fs.existsSync(file)) return [];

  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.log('Внимание: schedule.json не читается как JSON, используется алфавитный порядок.');
    return [];
  }

  if (!Array.isArray(data) && data && typeof data === 'object') {
    for (const key of ['queue', 'articles', 'schedule', 'order', 'items', 'posts', 'plan', 'list']) {
      if (Array.isArray(data[key])) { data = data[key]; break; }
    }
  }
  if (!Array.isArray(data)) {
    console.log('Внимание: в schedule.json не найден список статей, используется алфавитный порядок.');
    return [];
  }

  return data.map(normalizeEntry).filter(Boolean);
}

function queueFiles() {
  if (!fs.existsSync(QUEUE_DIR)) return [];
  return fs.readdirSync(QUEUE_DIR)
    .filter(f => f.toLowerCase().endsWith('.html'))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

/* ----------------------------------------------------- разбор HTML статьи */

function extractMeta(html, slug) {
  const meta = {};

  let m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (m) {
    meta.title = decodeEntities(m[1])
      .replace(/\s*[—–|-]\s*Frau\s*Fitness\s*$/i, '')
      .trim();
  }
  if (!meta.title) {
    m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (m) meta.title = decodeEntities(m[1].replace(/<[^>]+>/g, ''));
  }

  m = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i);
  if (m) meta.excerpt = decodeEntities(m[1]);
  if (!meta.excerpt) {
    m = html.match(/<meta\s+property=["']og:description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i);
    if (m) meta.excerpt = decodeEntities(m[1]);
  }

  m = html.match(/<meta\s+(?:property|name)=["'](?:article:section|tag|rubric|category)["']\s+content=["']([\s\S]*?)["']\s*\/?>/i);
  if (m) meta.tag = decodeEntities(m[1]);
  if (!meta.tag) {
    m = html.match(/<[^>]+class=["'][^"']*\bblog-tag\b[^"']*["'][^>]*>([\s\S]*?)</i);
    if (m) meta.tag = decodeEntities(m[1]);
  }
  if (!meta.tag) {
    const keywords = html.match(/<meta\s+name=["']keywords["']\s+content=["']([\s\S]*?)["']/i);
    if (keywords) {
      const hay = keywords[1].toLowerCase();
      const hit = KNOWN_TAGS.find(t => hay.includes(t.toLowerCase()));
      if (hit) meta.tag = hit;
    }
  }

  meta.slug = slug;
  return meta;
}

/** Проставляет сегодняшнюю дату внутри самой статьи (JSON-LD и подпись под заголовком). */
function stampDate(html, iso, human) {
  let out = html;
  out = out.replace(/"datePublished"\s*:\s*"\d{4}-\d{2}-\d{2}"/g, `"datePublished":"${iso}"`);
  out = out.replace(/"dateModified"\s*:\s*"\d{4}-\d{2}-\d{2}"/g, `"dateModified":"${iso}"`);
  out = out.replace(
    /(<div class="meta">[\s\S]{0,120}?<span>)([^<]*)(<\/span>)/i,
    (full, a, mid, b) => a + human + b
  );
  return out;
}

/* -------------------------------------------------------------- sitemap */

function updateSitemap(slug, iso) {
  if (!fs.existsSync(SITEMAP)) {
    console.log('Внимание: sitemap.xml не найден — пропускаю.');
    return false;
  }
  const loc = `${SITE}/blog/${slug}`;
  const newLine = `<url><loc>${escapeXml(loc)}</loc><lastmod>${iso}</lastmod>` +
                  `<changefreq>monthly</changefreq><priority>0.8</priority></url>`;

  const raw = fs.readFileSync(SITEMAP, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  let lines = raw.split(/\r?\n/);

  // убираем возможный дубль
  lines = lines.filter(l => !l.includes(`<loc>${loc}</loc>`));

  // освежаем lastmod у главной и у списка блога
  const bump = (line) => line.replace(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/, `<lastmod>${iso}</lastmod>`);
  lines = lines.map(l => {
    if (l.includes(`<loc>${SITE}/</loc>`) || l.includes(`<loc>${SITE}/blog</loc>`)) return bump(l);
    return l;
  });

  // вставляем перед первой статьёй блога, сохраняя отступ соседних строк
  let at = lines.findIndex(l => l.includes(`<loc>${SITE}/blog/`));
  if (at === -1) {
    const blogIndex = lines.findIndex(l => l.includes(`<loc>${SITE}/blog</loc>`));
    at = blogIndex >= 0 ? blogIndex + 1 : lines.findIndex(l => l.includes('</urlset>'));
  }
  if (at < 0) fail('не удалось понять структуру sitemap.xml');

  const indentSource = lines[at] || lines[at - 1] || '';
  const indent = (indentSource.match(/^[ \t]*/) || [''])[0];
  lines.splice(at, 0, indent + newLine);
  fs.writeFileSync(SITEMAP, lines.join(eol), 'utf8');
  return true;
}

/* ------------------------------------------------------------------ main */

function main() {
  if (!fs.existsSync(QUEUE_DIR)) fail('папка _queue не найдена.');
  if (!fs.existsSync(BLOG_DIR)) fail('папка blog не найдена.');

  const available = new Set(queueFiles());
  if (available.size === 0) {
    console.log('Очередь пуста — публиковать нечего.');
    setOutput('published', 'false');
    return;
  }

  const schedule = readSchedule();
  let planned = schedule.find(e => available.has(e.file)) || null;
  const fileName = planned ? planned.file : queueFiles()[0];
  if (!planned) planned = { file: fileName };

  const srcPath = path.join(QUEUE_DIR, fileName);
  const slug = fileName.replace(/\.html$/i, '');
  const destPath = path.join(BLOG_DIR, fileName);

  if (fs.existsSync(destPath)) {
    fail(`blog/${fileName} уже существует — публикация остановлена, чтобы ничего не перезаписать.`);
  }

  const iso = todayISO();
  const human = displayDate(iso);

  let html = fs.readFileSync(srcPath, 'utf8');
  const fromHtml = extractMeta(html, slug);

  const title = (planned.title || fromHtml.title || slug).trim();
  const excerpt = (planned.excerpt || fromHtml.excerpt || '').trim();
  const tag = (planned.tag || fromHtml.tag || DEFAULT_TAG).trim();

  html = stampDate(html, iso, human);

  // 1. переносим файл
  fs.writeFileSync(destPath, html, 'utf8');
  fs.unlinkSync(srcPath);

  // 2. articles.json
  let articles = [];
  if (fs.existsSync(ARTICLES_JSON)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(ARTICLES_JSON, 'utf8'));
      if (Array.isArray(parsed)) articles = parsed;
    } catch (e) {
      fail('blog/articles.json не читается как JSON.');
    }
  }
  articles = articles.filter(a => a && a.slug !== slug);
  articles.unshift({ slug, title, excerpt, tag, date: iso, dateDisplay: human });
  fs.writeFileSync(ARTICLES_JSON, JSON.stringify(articles, null, 2) + '\n', 'utf8');

  // 3. sitemap.xml
  updateSitemap(slug, iso);

  const left = queueFiles().length;

  console.log(`Опубликовано: ${title}`);
  console.log(`Слаг: ${slug} | дата: ${iso} | рубрика: ${tag}`);
  console.log(`Осталось в очереди: ${left}`);

  setOutput('published', 'true');
  setOutput('title', title);
  setOutput('slug', slug);
  setOutput('date', iso);
  setOutput('tag', tag);
  setOutput('left', String(left));
}

main();
