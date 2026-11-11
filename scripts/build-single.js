/* CSS · JS 를 한 파일에 넣은 단일 HTML 을 만든다 (파일 하나만 올리면 되는 곳에 배포할 때).
 * 실행: node scripts/build-single.js [출력경로] [--fragment] [--no-print]
 *   --fragment  <html>/<head>/<body> 껍데기 없이 내용만 출력
 *   --no-print  인쇄 버튼을 숨김 (인쇄 창을 열 수 없는 환경용) */
var fs = require("fs"), path = require("path");
var root = path.join(__dirname, "..");
var args = process.argv.slice(2);
var out = args.filter(function (a) { return a.indexOf("--") !== 0; })[0] || path.join(root, "dist", "index.html");
var read = function (f) { return fs.readFileSync(path.join(root, f), "utf8"); };
var between = function (s, tag) { return s.split("<!-- " + tag + ":start -->")[1].split("<!-- " + tag + ":end -->")[0].trim(); };

var html = read("index.html");
var js = ["data.js", "matcher.js", "app.js"].map(read).join("\n").replace(/<\/script/g, "<\\/script");
var inner = between(html, "head") + "\n<style>\n" + read("styles.css") + "</style>\n" + between(html, "body") + "\n<script>\n" +
  (args.indexOf("--no-print") !== -1 ? "window.ENT_NO_PRINT = true;\n" : "") + js + "</script>\n";
var page = args.indexOf("--fragment") !== -1 ? inner :
  '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  inner.replace("<div id=\"app\">", "</head>\n<body>\n<div id=\"app\">") + "</body>\n</html>\n";

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(out + "  (" + Math.round(page.length / 1024) + " KB)");
