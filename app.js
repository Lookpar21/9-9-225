// Baccarat Road logic
const storeKey = "baccarat:results:v1"; // stores array like ["B","P","T",...]
let results = load();

const $ = (sel, root=document)=>root.querySelector(sel);
const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));

function load(){
  try { return JSON.parse(localStorage.getItem(storeKey)) ?? []; }
  catch { return []; }
}
function save(){
  localStorage.setItem(storeKey, JSON.stringify(results));
}

$("#btnP").addEventListener("click", ()=>addResult("P"));
$("#btnB").addEventListener("click", ()=>addResult("B"));
$("#btnT").addEventListener("click", ()=>addResult("T"));
$("#btnUndo").addEventListener("click", undo);
$("#btnClear").addEventListener("click", clearAll);
$("#btnExport").addEventListener("click", exportData);
$("#importInput").addEventListener("change", importData);
$("#btnSearch").addEventListener("click", runSearch);
$("#searchInput").addEventListener("keydown", e => { if(e.key==="Enter") runSearch(); });

function addResult(r){
  results.push(r.toUpperCase());
  save();
  render();
}
function undo(){
  results.pop();
  save();
  render();
}
function clearAll(){
  if(confirm("ล้างข้อมูลทั้งหมด?")) {
    results = [];
    save();
    render();
  }
}
function exportData(){
  const blob = new Blob([JSON.stringify(results)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "baccarat_results.json"; a.click();
  URL.revokeObjectURL(url);
}
function importData(ev){
  const file = ev.target.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const arr = JSON.parse(reader.result);
      if(Array.isArray(arr)) {
        results = arr.map(x => (x+"").toUpperCase()).filter(x => ["B","P","T"].includes(x));
        save();
        render();
      } else alert("ไฟล์ไม่ถูกต้อง");
    } catch {
      alert("อ่านไฟล์ไม่สำเร็จ");
    }
  };
  reader.readAsText(file);
}

// ---------- Big Road builder ----------
const MAX_ROWS = 6;

// place sequence of B/P (ties removed) into a 6-row grid columns
function buildBigRoad(seq){
  // grid map key "c,r" -> "B"/"P"
  const grid = new Map();
  const entries = []; // chronological, each: {side, col, row}
  const colHeights = new Map(); // col -> count

  let col = 0, row = 0;
  let prev = null;
  let maxCol = 0;

  function occupied(c,r){ return grid.has(`${c},${r}`); }
  function setCell(c,r,val){
    grid.set(`${c},${r}`, val);
    entries.push({side: val, col: c, row: r});
    colHeights.set(c, (colHeights.get(c)||0) + 1);
    if(c > maxCol) maxCol = c;
  }

  for(const s of seq){
    if(prev === null){
      col = 0; row = 0;
      setCell(col,row,s);
      prev = s;
      continue;
    }
    if(s !== prev){
      // new column
      col = maxCol + 1;
      row = 0;
      setCell(col,row,s);
      prev = s;
      continue;
    }
    // same as previous
    // try go down if free and < MAX_ROWS
    if(row < MAX_ROWS-1 && !occupied(col, row+1)){
      row += 1;
      setCell(col,row,s);
      prev = s;
    } else {
      // blocked/bottom: move to the right, same row; skip if occupied
      let c = col + 1;
      // move right until empty at same row
      while(occupied(c, row)) c++;
      col = c;
      setCell(col,row,s);
      prev = s;
    }
  }

  return { grid, entries, colHeights, maxCol };
}

// ---------- Derived Roads ----------
/*
We compute derived 'signals' per Big Road entry using lookback rules:
- LB=1 Big Eye Road
- LB=2 Small Road
- LB=3 Cockroach Road

Mapping: red => "B", blue => "P"
Rules:
- If current entry is FIRST in its column (row==0):
    compare lengths of (col-1-LB) and (col-2-LB). Equal => red ("B"), else blue ("P").
- Else (row>0):
    check if there exists a cell at (col-1-LB, row). Exists => red ("B"), else blue ("P").

Derived sequences are aligned to Big Road chronological entries; positions where col-? doesn't exist => null.
*/
function computeDerived(bigEntries, colHeightsSnapshot, gridSnapshot){
  // We need lengths for columns at time of each entry.
  // Since previous columns never change after moving on, using final heights works.
  const N = bigEntries.length;
  const d1 = new Array(N).fill(null); // Big Eye (LB=1)
  const d2 = new Array(N).fill(null); // Small (LB=2)
  const d3 = new Array(N).fill(null); // Cockroach (LB=3)

  function exists(c,r){ return gridSnapshot.has(`${c},${r}`); }
  function len(c){ return colHeightsSnapshot.get(c) || 0; }

  function evalForLB(idx, LB){
    const {col, row} = bigEntries[idx];
    if(col <= LB) return null; // no ref columns yet
    // first in column
    if(row === 0){
      const A = col - 1 - LB;
      const B = col - 2 - LB;
      if(A < 0 || B < 0) return null;
      const red = (len(A) === len(B));
      return red ? "B" : "P";
    } else {
      const C = col - 1 - LB;
      if(C < 0) return null;
      const red = exists(C, row);
      return red ? "B" : "P";
    }
  }

  for(let i=0;i<N;i++){
    d1[i] = evalForLB(i, 1);
    d2[i] = evalForLB(i, 2);
    d3[i] = evalForLB(i, 3);
  }
  return { bigEyeAligned: d1, smallAligned: d2, roachAligned: d3 };
}

// Build a board grid for visualizing a sequence (B/P) similar to Big Road placement
function buildBoardFromSeq(seq){
  const grid = new Map();
  let col=0, row=0, prev=null, maxCol=0;

  function occupied(c,r){ return grid.has(`${c},${r}`); }
  function setCell(c,r,val){
    grid.set(`${c},${r}`, val);
    if(c>maxCol) maxCol=c;
  }
  for(const s of seq){
    if(prev===null){
      col=0; row=0; setCell(col,row,s); prev=s; continue;
    }
    if(s!==prev){
      col=maxCol+1; row=0; setCell(col,row,s); prev=s; continue;
    }
    if(row<MAX_ROWS-1 && !occupied(col,row+1)){ row++; setCell(col,row,s); prev=s; }
    else { let c=col+1; while(occupied(c,row)) c++; col=c; setCell(col,row,s); prev=s; }
  }
  return grid;
}

// ---------- Rendering ----------
function render(){
  // Prepare sequences
  const bpSeq = results.filter(x => x==="B" || x==="P");
  const big = buildBigRoad(bpSeq);

  // Derived aligned signals
  const {bigEyeAligned, smallAligned, roachAligned} = computeDerived(big.entries, big.colHeights, big.grid);

  // Derived seq for plotting (drop nulls)
  const bigEyeSeq = bigEyeAligned.filter(x => x);
  const smallSeq = smallAligned.filter(x => x);
  const roachSeq = roachAligned.filter(x => x);

  // Draw boards
  drawRoad($("#bigRoad"), big.grid);
  drawRoad($("#bigEye"), buildBoardFromSeq(bigEyeSeq));
  drawRoad($("#smallRoad"), buildBoardFromSeq(smallSeq));
  drawRoad($("#cockroach"), buildBoardFromSeq(roachSeq));

  // History badges
  drawHistory(results);

  // Store aligned arrays for search
  window._aligned = {
    main: big.entries.map(e=>e.side),
    bigEye: bigEyeAligned, small: smallAligned, roach: roachAligned
  };
}

function drawRoad(container, gridMap){
  container.innerHTML = ""; // clear
  // Find max column
  let maxCol = -1;
  for(const key of gridMap.keys()){
    const c = parseInt(key.split(",")[0],10);
    if(c>maxCol) maxCol=c;
  }
  // Build column by column
  for(let c=0;c<=maxCol;c++){
    const colDiv = document.createElement("div");
    colDiv.className = "col";
    // 6 rows
    for(let r=0;r<MAX_ROWS;r++){
      const cell = document.createElement("div");
      cell.className = "cell";
      const val = gridMap.get(`${c},${r}`);
      if(val){
        cell.classList.add(val.toLowerCase());
        cell.textContent = val;
      }
      colDiv.appendChild(cell);
    }
    container.appendChild(colDiv);
  }
}

function drawHistory(arr){
  const host = $("#history");
  host.innerHTML = "";
  arr.forEach((x,i)=>{
    const d = document.createElement("span");
    d.className = `badge ${x.toLowerCase()}`;
    d.textContent = x;
    host.appendChild(d);
  });
}

// ---------- Search across 4 channels ----------
/*
User inputs 4 letters for channels 1..4 = (main, bigEye, small, roach).
We scan aligned arrays and find all indices k where:
main[k]==p1 && bigEye[k]==p2 && small[k]==p3 && roach[k]==p4 (all exist)
Then we report the distribution of next main outcome main[k+1].
*/
function runSearch(){
  const input = $("#searchInput").value.trim().toUpperCase();
  const box = $("#searchSummary");
  const list = $("#searchMatches");
  list.innerHTML = "";
  box.textContent = "";

  if(!/^[BP]{4}$/.test(input)){
    box.textContent = "กรอก 4 ตัวอักษรจาก B/P เท่านั้น เช่น BBPP";
    return;
  }
  const [p1,p2,p3,p4] = input.split("");

  const A = window._aligned || {main:[], bigEye:[], small:[], roach:[]};
  const N = A.main.length;

  let matches = [];
  let nextB=0, nextP=0, nextNone=0;

  for(let k=0;k<N;k++){
    const a=A.main[k], b=A.bigEye[k], c=A.small[k], d=A.roach[k];
    if(a && b && c && d && a===p1 && b===p2 && c===p3 && d===p4){
      const next = A.main[k+1];
      if(next==="B") nextB++;
      else if(next==="P") nextP++;
      else nextNone++;
      matches.push({index:k, vec:`${a}${b}${c}${d}`, next: next || "-"});
    }
  }

  const total = matches.length;
  const tip = total>0 ? (nextB===nextP ? "ไม่ชัดเจน" : (nextB>nextP?"แนะนำ: B":"แนะนำ: P")) : "ไม่พบรูปแบบนี้";
  box.innerHTML = `<b>ผลการค้นหา:</b> พบ ${total} ครั้ง — ตาถัดไป B=${nextB}, P=${nextP}${nextNone?`, ไม่มีข้อมูล=${nextNone}`:""} → <b>${tip}</b>`;

  matches.slice(-50).forEach(m=>{
    const row = document.createElement("div");
    row.className = "match";
    row.innerHTML = `<span class="vec">[${m.vec}]</span> <span class="muted">index ${m.index}</span> <b>ถัดไป: ${m.next}</b>`;
    list.appendChild(row);
  });
}

// ---------- Initial render ----------
render();
