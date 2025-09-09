// Baccarat Road logic (incremental derived computation)
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

// ---------- Big Road + Derived (incremental) ----------
const MAX_ROWS = 6;

// return {grid, entries, d1, d2, d3}
// where d1=BigEye, d2=Small, d3=Cockroach aligned per Big Road entry
function buildBigWithDerived(seqBP){
  const grid = new Map();              // "c,r" => "B"/"P"
  const entries = [];                  // {side,col,row}
  const colHeights = new Map();        // col => height
  let maxCol = -1;

  function occupied(c,r){ return grid.has(`${c},${r}`); }
  function len(c){ return colHeights.get(c) || 0; }
  function setCell(c,r,val){
    grid.set(`${c},${r}`, val);
    colHeights.set(c, len(c)+1);
    if(c>maxCol) maxCol=c;
  }

  function evalDerived(col, row, LB){
    // rules based on current grid/lengths at this moment
    if(col <= LB) return null; // need enough previous columns
    if(row === 0){
      const A = col - 1 - LB;
      const B = col - 2 - LB;
      if(A < 0 || B < 0) return null;
      return (len(A) === len(B)) ? "B" : "P";  // red => B, blue => P
    } else {
      const C = col - 1 - LB;
      if(C < 0) return null;
      const exists = occupied(C, row);
      return exists ? "B" : "P";
    }
  }

  let prev = null, col = 0, row = 0;
  const d1 = []; const d2 = []; const d3 = [];

  for(const s of seqBP){
    if(prev === null){
      col = 0; row = 0;
      setCell(col,row,s);
      // after placing, compute derived at this step
      d1.push(evalDerived(col,row,1));
      d2.push(evalDerived(col,row,2));
      d3.push(evalDerived(col,row,3));
      entries.push({side:s,col,row});
      prev = s;
      continue;
    }
    if(s !== prev){
      // new column
      col = maxCol + 1;
      row = 0;
      setCell(col,row,s);
      d1.push(evalDerived(col,row,1));
      d2.push(evalDerived(col,row,2));
      d3.push(evalDerived(col,row,3));
      entries.push({side:s,col,row});
      prev = s;
      continue;
    }
    // same side
    if(row < MAX_ROWS-1 && !occupied(col, row+1)){
      row += 1;
      setCell(col,row,s);
    } else {
      // go right on same row to first empty
      let c = col + 1;
      while(occupied(c, row)) c++;
      col = c;
      setCell(col,row,s);
    }
    d1.push(evalDerived(col,row,1));
    d2.push(evalDerived(col,row,2));
    d3.push(evalDerived(col,row,3));
    entries.push({side:s,col,row});
    prev = s;
  }

  return {grid, entries, d1, d2, d3};
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

  const big = buildBigWithDerived(bpSeq);
  const bigEyeSeq = big.d1.filter(x => x);
  const smallSeq  = big.d2.filter(x => x);
  const roachSeq  = big.d3.filter(x => x);

  // Draw boards
  drawRoad($("#bigRoad"), big.grid);
  drawRoad($("#bigEye"), buildBoardFromSeq(bigEyeSeq));
  drawRoad($("#smallRoad"), buildBoardFromSeq(smallSeq));
  drawRoad($("#cockroach"), buildBoardFromSeq(roachSeq));

  // History badges
  drawHistory(results);

  // For search (aligned to Big Road entries)
  window._aligned = {
    main: big.entries.map(e=>e.side),
    bigEye: big.d1, small: big.d2, roach: big.d3
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
  if(maxCol < 0){
    // show empty 12 columns placeholder for nicer look
    for(let i=0;i<12;i++){
      const colDiv = document.createElement("div");
      colDiv.className = "col";
      for(let r=0;r<MAX_ROWS;r++){
        const cell = document.createElement("div");
        cell.className = "cell";
        colDiv.appendChild(cell);
      }
      container.appendChild(colDiv);
    }
    return;
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


// ================= Manual mode =================
const manualStoreKey = "baccarat:manual:v1";
let manual = loadManual();

function loadManual(){
  try {
    const d = JSON.parse(localStorage.getItem(manualStoreKey)) || {};
    return {
      enabled: !!d.enabled,
      main: Array.isArray(d.main)? d.main : [],
      bigEye: Array.isArray(d.bigEye)? d.bigEye : [],
      small: Array.isArray(d.small)? d.small : [],
      roach: Array.isArray(d.roach)? d.roach : []
    };
  } catch { 
    return {enabled:false, main:[], bigEye:[], small:[], roach:[]}; 
  }
}
function saveManual(){
  localStorage.setItem(manualStoreKey, JSON.stringify(manual));
}

// Hook UI if exists
const manualToggle = document.getElementById("manualToggle");
if (manualToggle){
  manualToggle.checked = manual.enabled;
  manualToggle.addEventListener("change", () => { 
    manual.enabled = manualToggle.checked; 
    saveManual(); render(); 
  });
  // buttons
  const map = [
    ["mP","main","P"], ["mB","main","B"], ["mT","main","T"],
    ["mBE_B","bigEye","B"], ["mBE_P","bigEye","P"],
    ["mSM_B","small","B"], ["mSM_P","small","P"],
    ["mCR_B","roach","B"], ["mCR_P","roach","P"],
  ];
  for(const [id, key, val] of map){
    const el = document.getElementById(id);
    if(el) el.addEventListener("click", ()=>{
      manual[key].push(val);
      saveManual(); render();
    });
  }
}

// Helper to build boards in manual mode
function buildManualBoards(){
  // main uses B/P only for big road (ties ignored for placement)
  const mainBP = manual.main.filter(x=>x==="B"||x==="P");
  const big = buildBigWithDerived(mainBP); // we still compute derived internally but won't use for display

  const bigEyeSeq = manual.bigEye.slice();
  const smallSeq = manual.small.slice();
  const roachSeq = manual.roach.slice();

  // draw
  drawRoad($("#bigRoad"), big.grid);
  drawRoad($("#bigEye"), buildBoardFromSeq(bigEyeSeq));
  drawRoad($("#smallRoad"), buildBoardFromSeq(smallSeq));
  drawRoad($("#cockroach"), buildBoardFromSeq(roachSeq));

  // search arrays are taken directly from manual
  window._aligned = {
    main: manual.main.map(x => (x==="B"||x==="P")?x:null), 
    bigEye: manual.bigEye.slice(),
    small: manual.small.slice(),
    roach: manual.roach.slice()
  };
}

// Patch render to respect manual mode
const _renderOriginal = render;
render = function(){
  if(manual.enabled){
    // draw using manual inputs
    buildManualBoards();
    // history still shows actual results list
    drawHistory(results);
  } else {
    _renderOriginal();
  }
};
