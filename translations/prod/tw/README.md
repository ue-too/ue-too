<h1 align="center">
    板班
</h1>
<p align="center">
    板班可以讓你的 HTML Canvas 變得很厲害！平移、縮放、甚至是旋轉，都不需要你操心！如果你對無限畫布有興趣，這個就是你需要的！
</p>
<p align="center">
    <a href="https://www.npmjs.com/package/@niuee/board">
        <img src="https://img.shields.io/npm/v/@niuee/board.svg?style=for-the-badge" alt="continuous integration" style="height: 20px;">
    </a>
    <a href="https://github.com/niuee/board/actions/workflows/node.js.yml">
        <img src="https://img.shields.io/github/actions/workflow/status/niuee/board/node.js.yml?branch=main&label=test&style=for-the-badge" alt="contributors" style="height: 20px;">
    </a>
    <a href="https://github.com/niuee/board/blob/main/LICENSE.txt">
        <img src="https://img.shields.io/github/license/niuee/board?style=for-the-badge" alt="contributors" style="height: 20px;">
    </a>

</p>

<p align="center">
  •
  <a href="#installation-and-usage">下載</a> •
  <a href="#key-features">重點功能</a> •
  <a href="#bare-minimum-example">最簡單可以跑起來的範例</a> •
  <a href="#how-to-use">如何使用</a>

</p>

這不是一個像是 excalidraw 或是 tl;draw 那樣完整的產品，而是一個你可以當做基底，做出像是 excalidraw 的 app。這個函式庫主要是想要幫你節省一些時間，不用去花太多時間實作 `canvas` 的平移、縮放、以及旋轉的功能！

[CodeSandbox 連結](https://codesandbox.io/p/sandbox/board-example-y2dycd?layout=%257B%2522sidebarPanel%2522%253A%2522EXPLORER%2522%252C%2522rootPanelGroup%2522%253A%257B%2522direction%2522%253A%2522horizontal%2522%252C%2522contentType%2522%253A%2522UNKNOWN%2522%252C%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522id%2522%253A%2522ROOT_LAYOUT%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522UNKNOWN%2522%252C%2522direction%2522%253A%2522vertical%2522%252C%2522id%2522%253A%2522clw2y7l7v00063b6iiev37bos%2522%252C%2522sizes%2522%253A%255B100%252C0%255D%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522EDITOR%2522%252C%2522direction%2522%253A%2522horizontal%2522%252C%2522id%2522%253A%2522EDITOR%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL%2522%252C%2522contentType%2522%253A%2522EDITOR%2522%252C%2522id%2522%253A%2522clw2y7l7v00023b6ikchwe6hz%2522%257D%255D%257D%252C%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522SHELLS%2522%252C%2522direction%2522%253A%2522horizontal%2522%252C%2522id%2522%253A%2522SHELLS%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL%2522%252C%2522contentType%2522%253A%2522SHELLS%2522%252C%2522id%2522%253A%2522clw2y7l7v00033b6ikl1vhmzw%2522%257D%255D%252C%2522sizes%2522%253A%255B100%255D%257D%255D%257D%252C%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522DEVTOOLS%2522%252C%2522direction%2522%253A%2522vertical%2522%252C%2522id%2522%253A%2522DEVTOOLS%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL%2522%252C%2522contentType%2522%253A%2522DEVTOOLS%2522%252C%2522id%2522%253A%2522clw2y7l7v00053b6iwbyc1zfu%2522%257D%255D%252C%2522sizes%2522%253A%255B100%255D%257D%255D%252C%2522sizes%2522%253A%255B46.32162767975171%252C53.67837232024829%255D%257D%252C%2522tabbedPanels%2522%253A%257B%2522clw2y7l7v00023b6ikchwe6hz%2522%253A%257B%2522tabs%2522%253A%255B%257B%2522id%2522%253A%2522clw2y7l7v00013b6iiagi3t0j%2522%252C%2522mode%2522%253A%2522permanent%2522%252C%2522type%2522%253A%2522FILE%2522%252C%2522filepath%2522%253A%2522%252Fsrc%252Findex.html%2522%252C%2522state%2522%253A%2522IDLE%2522%257D%252C%257B%2522id%2522%253A%2522clw4g5a2x00023b6icusokwho%2522%252C%2522mode%2522%253A%2522permanent%2522%252C%2522type%2522%253A%2522FILE%2522%252C%2522initialSelections%2522%253A%255B%257B%2522startLineNumber%2522%253A15%252C%2522startColumn%2522%253A29%252C%2522endLineNumber%2522%253A15%252C%2522endColumn%2522%253A29%257D%255D%252C%2522filepath%2522%253A%2522%252Fsrc%252Findex.mjs%2522%252C%2522state%2522%253A%2522IDLE%2522%257D%255D%252C%2522id%2522%253A%2522clw2y7l7v00023b6ikchwe6hz%2522%252C%2522activeTabId%2522%253A%2522clw4g5a2x00023b6icusokwho%2522%257D%252C%2522clw2y7l7v00053b6iwbyc1zfu%2522%253A%257B%2522tabs%2522%253A%255B%257B%2522id%2522%253A%2522clw2y7l7v00043b6ic6f06neh%2522%252C%2522mode%2522%253A%2522permanent%2522%252C%2522type%2522%253A%2522UNASSIGNED_PORT%2522%252C%2522port%2522%253A0%252C%2522path%2522%253A%2522%252F%2522%257D%255D%252C%2522id%2522%253A%2522clw2y7l7v00053b6iwbyc1zfu%2522%252C%2522activeTabId%2522%253A%2522clw2y7l7v00043b6ic6f06neh%2522%257D%252C%2522clw2y7l7v00033b6ikl1vhmzw%2522%253A%257B%2522tabs%2522%253A%255B%255D%252C%2522id%2522%253A%2522clw2y7l7v00033b6ikl1vhmzw%2522%257D%257D%252C%2522showDevtools%2522%253Atrue%252C%2522showShells%2522%253Afalse%252C%2522showSidebar%2522%253Atrue%252C%2522sidebarPanelSize%2522%253A15%257D) 你可以試試看是不是你想要的～

## Docs
- [中文文件連結](https://niuee.github.io/board/tw/index.html) (還在很早期的階段，目前很努力在補齊文件中)
- [英文文件連結](https://niuee.github.io/board/index.html)

- [初期設計文件](https://hackmd.io/@niuee/ByKskjAUp)

## Installation and Usage
### 如果你有使用套件管理像是 npm、pnpm、yarn、等等
```bash
npm install @niuee/board
```
然後就可以從 `@niuee/board` import

```javascript
import { BoardV2 } from "@niuee/board";
```

### 從 GitHub release 下載
從[releases](https://github.com/niuee/board/releases/)下載已經打包過後的 JavaScript (board.js)，然後放在你的專案裡面讓其他 JavaScript 模組 import。像是這樣：
```javascript
import { Board } from "./board.js";
```

### 從 jsdelivr import
```javascript
import { Board } from "https://cdn.jsdelivr.net/npm/@niuee/board@latest/index.mjs";
```

### 使用 iife bundle
在你的 HTML 檔案裡面使用 `script` 標籤去把 board import 近來
```html
<script src="https://cdn.jsdelivr.net/npm/@niuee/board@latest/iife/index.js"></script>
```

然後在其他的 JavaScript 檔案裡面你可以用 Board.{類別或函式} 去使用 `@niuee/board` export 的東西。

如果要使用 `board` 類別的話可以像下面這樣使用。
```javascript
const newBoard = new Board.Board(canvasElement);
```

## Key Features
- 支援各種輸入模式，鍵盤滑鼠、觸控板、觸控都可以！
- 只需要 HTML 跟 Vanilla JavaScript，但是也可以整合進去你想要的前端函式庫或是框架。
- 是用相機的比喻去實作所以可以有很多酷酷的應用，類似運鏡的方式去操作。

## Bare Minimum Example

```javascript
import { Board } from "@niuee/board"; // or other import style mentioned above

const canvasElement = document.querySelector("canvas");
const board = new Board(canvasElement);


// this is the callback function for the requestAnimationFrame
function step(timestamp){
    // timestamp is the argument requestAnimationFrame pass to its callback function

    // step the board first before everything else because stepping the board would wipe the canvas
    // pass in the timestamp as it is to the board's step function.
    board.step(timestamp);

    // if you want to draw stuff draw it in the step function otherwise it would not persist
    // draw a circle at (100, 100) with a width of 1px
    board.context.beginPath();
    board.context.arc(100, 100, 1, 0, 2 * Math.PI);
    board.context.stroke();

    // and then call the requestAnimationFrame
    window.requestAnimationFrame(step);
}

// start the animation loop
step(0);
```

## How To Use

`board` 這個類別的建構子需要的參數是一個 HTML 的 canvas element。所以如果要建立一個 `board` 你需要在你的 DOM 裡面有一個 HTML canvas。

```html
<canvas id="board"></canvas>
```

在這裡需要使用 `requestAnimationFrame` 這個 web API。然後在 `requestAnimationFrame` 的 callback 裡面呼叫 `board` 的 `step` 函數。
```javascript
import { Board } from "@niuee/board";

const canvasElement = document.getElementById("board");
const board = new Board(canvasElement); // if you are using this library through iife don't use the variable name board since it would have name conflict with the library

// this is the callback function for the requestAnimationFrame
function step(timestamp){
    // timestamp is the argument requestAnimationFrame pass to its callback function

    // step the board first before everything else because stepping the board would wipe the canvas
    // pass in the timestamp as it is to the board's step function.
    board.step(timestamp);

    // do your stuff

    // and then call the requestAnimationFrame
    window.requestAnimationFrame(step);
}

// start the animation loop
step(0);
```
現在你的 canvas 應該就具備基本的平移、縮放、跟旋轉的功能。

預設的座標系統是跟 HTML 的 canvas 是一樣的。螢幕上往下是 y 軸的正方向。

現在 canvas 上面應該沒有任何東西；我們可以取得 canvas 的 2d context 在 canvas 上面作畫。
```javascript
// draw a circle at the location (10, 10)
board.context.beginPath();
board.context.arc(10, 10, 5, 0, 2 * Math.PI);
board.context.stroke();
```

上面這個會在 canvas 上面的原點右下角畫上一個黑色的圓圈。

This is probably a good time to talk about the coordinate system @niuee/board uses.
現在差不多可以來討論一下板班使用的座標系統。

在大部分的情況下預設的座標系統就足以應付了。如果你對 canvas API 已經很熟悉的話，預設的座標系統也會是比較好的選擇。

不過板班還是提供一個翻轉 y 軸的選縣。如果你對平常 y 軸往上為正的座標系統比較自在的話也可以把座標系統顛倒過來。

只需要把 `board` 類別的 `alignCoordinateSystem` 屬性設成 `false`.
```javascript
board.alignCoordinateSystem = false;
```
這樣就會是顛倒的座標系統。不過有一點需要注意的是雖然 `board` 的座標系統是反過來的，但是 `context` 的座標系統還是跟普通的 `canvas` 是一樣的，所以作畫的時候要特別注意 y 軸的座標。

舉例來說，如果你想要畫一個圓圈在座標 (30, 30) 的位置在已經反過來的座標系統（所以用看的是會出現在螢幕中原點的右上方），你需要把 y 軸的座標反過來給 `context` 。

像是這樣：
```javascript
// notice the negative sign for the y coordinate
context.arc(30, -30, 5, 0, Math.PI * 2);
```
顛倒過來的 y 軸還有一個不同的地方，就是旋轉的正方向。

在跟一般 canvas 座標系統一樣時，旋轉的方向也是一樣的，順時針是正的。
反過來的話，逆時針就是正的。

這個 [API 文件](https://niuee.github.io/board/index.html) 有把全部的 API 都列出來。

我目前還在規劃一個有範例應用的網站，還有把 API 文件補得更齊全一點！
