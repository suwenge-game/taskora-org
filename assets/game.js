(function () {
  "use strict";

  var SYMBOLS = "0123456789+-*/=";
  var STORAGE = "numble-daily-v1";
  var MAX_ROWS = 6;

  function hash(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function localDate(offset) {
    var d = new Date(); d.setDate(d.getDate() + (offset || 0));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function compute(expr) {
    if (!/^\d+(?:[+\-*/]\d+)+$/.test(expr)) return null;
    var tokens = expr.match(/\d+|[+\-*/]/g), nums = [], ops = [], i;
    for (i = 0; i < tokens.length; i++) {
      if (/^\d+$/.test(tokens[i])) { if (tokens[i].length > 1 && tokens[i][0] === "0") return null; nums.push(Number(tokens[i])); }
      else ops.push(tokens[i]);
    }
    for (i = 0; i < ops.length;) {
      if (ops[i] === "*" || ops[i] === "/") {
        if (ops[i] === "/" && (nums[i + 1] === 0 || nums[i] % nums[i + 1] !== 0)) return null;
        nums.splice(i, 2, ops[i] === "*" ? nums[i] * nums[i + 1] : nums[i] / nums[i + 1]); ops.splice(i, 1);
      } else i++;
    }
    var result = nums[0];
    for (i = 0; i < ops.length; i++) result = ops[i] === "+" ? result + nums[i + 1] : result - nums[i + 1];
    return Number.isFinite(result) ? result : null;
  }
  function validEquation(text, length) {
    if (text.length !== length || (text.match(/=/g) || []).length !== 1) return false;
    var sides = text.split("=");
    if (!/^\d+$/.test(sides[1]) || (sides[1].length > 1 && sides[1][0] === "0")) return false;
    var value = compute(sides[0]);
    return value !== null && value >= 0 && value === Number(sides[1]);
  }
  function candidates(length) {
    var out = [], a, b, c, op1, op2, left, result, eq;
    var ops = ["+", "-", "*", "/"];
    for (a = 1; a <= 99; a++) for (b = 1; b <= 99; b++) for (op1 = 0; op1 < ops.length; op1++) {
      left = "" + a + ops[op1] + b; result = compute(left); eq = left + "=" + result;
      if (result >= 0 && Number.isInteger(result) && eq.length === length && (length !== 8 || eq.indexOf("=") >= 5)) out.push(eq);
    }
    if (length === 8) for (a = 1; a <= 9; a++) for (b = 1; b <= 9; b++) for (c = 1; c <= 9; c++) for (op1 = 0; op1 < 4; op1++) for (op2 = 0; op2 < 4; op2++) {
      left = "" + a + ops[op1] + b + ops[op2] + c; result = compute(left); eq = left + "=" + result;
      if (result >= 0 && Number.isInteger(result) && eq.length === length && eq.indexOf("=") >= 5) out.push(eq);
    }
    return out;
  }
  var pools = { 8: candidates(8), 6: candidates(6) };
  function generate(length, seed) { var pool = pools[length]; return pool[Math.floor(mulberry32(seed)() * pool.length)]; }
  function feedback(guess, answer) {
    var result = new Array(answer.length).fill("absent"), counts = {}, i;
    for (i = 0; i < answer.length; i++) if (guess[i] === answer[i]) result[i] = "correct"; else counts[answer[i]] = (counts[answer[i]] || 0) + 1;
    for (i = 0; i < answer.length; i++) if (result[i] !== "correct" && counts[guess[i]]) { result[i] = "present"; counts[guess[i]]--; }
    return result;
  }
  function loadStats() { try { return JSON.parse(localStorage.getItem(STORAGE)) || { played: 0, wins: 0, streak: 0, bestStreak: 0, bestTimes: { classic: [], mini: [] }, lastDailyWin: "" }; } catch (e) { return { played: 0, wins: 0, streak: 0, bestStreak: 0, bestTimes: { classic: [], mini: [] } }; } }
  function saveStats(s) { try { localStorage.setItem(STORAGE, JSON.stringify(s)); } catch (e) {} }

  function Game(host) {
    this.host = host; this.mode = host.dataset.mode || "practice"; this.length = 8; this.guesses = []; this.current = ""; this.over = false; this.started = Date.now(); this.build(); this.start();
  }
  Game.prototype.build = function () {
    this.host.innerHTML = '<div class="ng-top"><div class="ng-modes" role="group" aria-label="Game mode"><button data-kind="daily">Daily</button><button data-kind="practice">Practice</button><button data-kind="mini">Mini 6</button></div><div class="ng-meta"><span class="ng-clock">00:00</span><span class="ng-progress">Guess 1/6</span></div></div><div class="ng-board" role="grid" aria-label="Equation guesses"></div><p class="ng-message" aria-live="polite">Enter a valid equation.</p><div class="ng-keyboard" aria-label="Calculator keyboard"></div><div class="ng-stats"></div>';
    this.board = this.host.querySelector(".ng-board"); this.message = this.host.querySelector(".ng-message"); this.progress = this.host.querySelector(".ng-progress"); this.clock = this.host.querySelector(".ng-clock"); this.stats = this.host.querySelector(".ng-stats");
    var self = this;
    this.host.querySelectorAll(".ng-modes button").forEach(function (b) { b.addEventListener("click", function () { self.mode = b.dataset.kind; self.length = self.mode === "mini" ? 6 : 8; self.start(); }); });
    var rows = [["7","8","9","/"],["4","5","6","*"],["1","2","3","-"],["0","=","DEL","+"],["ENTER"]];
    var kb = this.host.querySelector(".ng-keyboard"); rows.forEach(function (row) { var div = document.createElement("div"); if (row.length === 1) div.style.gridTemplateColumns="1fr"; row.forEach(function (key) { var b = document.createElement("button"); b.type="button"; b.textContent=key === "ENTER" ? "SUBMIT" : key; if (key === "ENTER") { b.style.background="#a3e635"; b.style.letterSpacing=".08em"; } b.dataset.key=key; b.addEventListener("click", function(){ self.input(key); }); div.appendChild(b); }); kb.appendChild(div); });
    document.addEventListener("keydown", function (e) { var k = e.key; if (k === "Enter") k = "ENTER"; if (k === "Backspace" || k === "Delete") k = "DEL"; if (SYMBOLS.indexOf(k) >= 0 || k === "DEL" || k === "ENTER") { e.preventDefault(); self.input(k); } });
  };
  Game.prototype.start = function () {
    clearInterval(this.timer); this.guesses=[]; this.current=""; this.over=false; this.started=Date.now();
    var seed = this.mode === "daily" ? hash(localDate()) : Math.floor(Math.random()*4294967295);
    this.answer=generate(this.length, seed); this.message.textContent=this.mode === "daily" ? "Today’s equation is fixed for everyone." : "Enter a mathematically valid equation.";
    this.host.querySelectorAll(".ng-modes button").forEach(function(b){ b.classList.toggle("active", b.dataset.kind === this.mode); }, this);
    this.render(); var self=this; this.timer=setInterval(function(){ self.updateClock(); },1000); this.updateStats();
  };
  Game.prototype.input = function (key) {
    if (this.over) return;
    if (key === "DEL") this.current=this.current.slice(0,-1);
    else if (key === "ENTER") this.submit();
    else if (this.current.length < this.length) this.current += key;
    this.render();
  };
  Game.prototype.submit = function () {
    if (this.current.length !== this.length) return this.notice("Equation needs exactly " + this.length + " characters.", true);
    if (!validEquation(this.current, this.length)) return this.notice("That equation is not mathematically valid.", true);
    this.guesses.push(this.current); var won=this.current===this.answer; this.current="";
    if (won || this.guesses.length === MAX_ROWS) this.finish(won); else this.notice("Valid equation — keep deducing.");
  };
  Game.prototype.finish = function (won) {
    this.over=true; clearInterval(this.timer); var seconds=Math.max(1,Math.floor((Date.now()-this.started)/1000)); var s=loadStats(); s.played=(s.played||0)+1;
    if (won) { s.wins=(s.wins||0)+1; if (this.mode === "daily") { var yesterday=localDate(-1); s.streak=s.lastDailyWin===yesterday?(s.streak||0)+1:s.lastDailyWin===localDate()?s.streak:1; s.lastDailyWin=localDate(); s.bestStreak=Math.max(s.bestStreak||0,s.streak||0); } var bucket=this.length===6?"mini":"classic"; s.bestTimes=s.bestTimes||{classic:[],mini:[]}; s.bestTimes[bucket]=(s.bestTimes[bucket]||[]).concat([{errors:this.guesses.length-1,time:seconds}]).sort(function(a,b){return a.errors-b.errors||a.time-b.time;}).slice(0,10); }
    else if (this.mode === "daily") s.streak=0;
    saveStats(s); this.notice(won ? "Solved in " + this.guesses.length + "/6 — " + this.answer : "The equation was " + this.answer, !won); this.updateStats(); this.render();
  };
  Game.prototype.notice=function(text,error){this.message.textContent=text;this.message.classList.toggle("error",!!error);};
  Game.prototype.updateClock=function(){var sec=Math.floor((Date.now()-this.started)/1000);this.clock.textContent=String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");};
  Game.prototype.updateStats=function(){var s=loadStats();this.stats.innerHTML='<span><b>'+(s.played||0)+'</b> played</span><span><b>'+(s.wins||0)+'</b> wins</span><span><b>'+(s.streak||0)+'</b> streak</span><span><b>'+(s.bestStreak||0)+'</b> best</span>';};
  Game.prototype.render=function(){
    this.board.style.setProperty("--cols",this.length); this.board.innerHTML="";
    for(var r=0;r<MAX_ROWS;r++){var word=this.guesses[r]||(r===this.guesses.length?this.current:"");var states=this.guesses[r]?feedback(word,this.answer):[];for(var c=0;c<this.length;c++){var tile=document.createElement("div");tile.className="ng-tile"+(states[c]?" "+states[c]:"")+(word[c]?" filled":"");tile.setAttribute("role","gridcell");tile.textContent=word[c]||"";this.board.appendChild(tile);}}
    this.progress.textContent="Guess "+Math.min(this.guesses.length+1,6)+"/6";
    var ranks={absent:1,present:2,correct:3}, status={}; for(var i=0;i<this.guesses.length;i++){var f=feedback(this.guesses[i],this.answer);for(var j=0;j<f.length;j++)if(!status[this.guesses[i][j]]||ranks[f[j]]>ranks[status[this.guesses[i][j]]])status[this.guesses[i][j]]=f[j];}
    this.host.querySelectorAll("[data-key]").forEach(function(b){b.classList.remove("correct","present","absent");if(status[b.dataset.key])b.classList.add(status[b.dataset.key]);});
  };
  document.querySelectorAll("[data-numble-game]").forEach(function(host){host.__game=new Game(host);});
  window.NumbleTest={compute:compute,validEquation:validEquation,feedback:feedback,generate:generate,hash:hash,pools:pools};
}());
