import type { Problem } from '../types/problem';

export const INITIAL_PROBLEMS: Problem[] = [
  {
    uuid: 'chem-baso4-20260916-001',
    subject: '化学',
    type: '简答',
    date: '20260916',
    summary: 'BaSO4焙烧制备钛酸钡工业流程',
    raw_html: `<div class="naosu-problem" subject="化学" type="简答" date="20260916" summary="BaSO4焙烧制备钛酸钡工业流程" uuid="chem-baso4-20260916-001">
  <div class="problem-body">
    <div class="img">
      <svg viewBox="0 0 740 115" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#000000"/>
          </marker>
        </defs>
        <text x="32" y="44" font-size="11" font-family="Times New Roman, SimSun" text-anchor="middle">BaSO<tspan dy="3" font-size="8">4</tspan><tspan dy="-3">过</tspan></text>
        <text x="32" y="58" font-size="11" font-family="SimSun" text-anchor="middle">量碳粉</text>
        <text x="32" y="72" font-size="11" font-family="SimSun" text-anchor="middle">过量氯</text>
        <text x="32" y="86" font-size="11" font-family="SimSun" text-anchor="middle">化钙</text>
        <line x1="58" y1="62" x2="80" y2="62" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <rect x="80" y="49" width="46" height="26" fill="#ffffff" stroke="#000000" stroke-width="1.1"/>
        <text x="103" y="66" font-size="12" font-family="SimSun" text-anchor="middle">焙烧</text>
        <line x1="103" y1="75" x2="103" y2="94" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <text x="103" y="106" font-size="11" font-family="Times New Roman, SimSun" text-anchor="middle">CO</text>
        <line x1="126" y1="62" x2="148" y2="62" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <rect x="148" y="49" width="46" height="26" fill="#ffffff" stroke="#000000" stroke-width="1.1"/>
        <text x="171" y="66" font-size="12" font-family="SimSun" text-anchor="middle">浸取</text>
        <text x="171" y="24" font-size="11" font-family="SimSun" text-anchor="middle">水</text>
        <line x1="171" y1="28" x2="171" y2="49" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <line x1="171" y1="75" x2="171" y2="94" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <text x="171" y="106" font-size="11" font-family="SimSun" text-anchor="middle">滤渣</text>
        <line x1="194" y1="62" x2="216" y2="62" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <rect x="216" y="49" width="46" height="26" fill="#ffffff" stroke="#000000" stroke-width="1.1"/>
        <text x="239" y="66" font-size="12" font-family="SimSun" text-anchor="middle">酸化</text>
        <text x="239" y="24" font-size="11" font-family="SimSun" text-anchor="middle">酸</text>
        <line x1="239" y1="28" x2="239" y2="49" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <line x1="262" y1="62" x2="284" y2="62" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <rect x="284" y="49" width="62" height="26" fill="#ffffff" stroke="#000000" stroke-width="1.1"/>
        <text x="315" y="66" font-size="12" font-family="SimSun" text-anchor="middle">浓缩结晶</text>
        <line x1="315" y1="75" x2="315" y2="94" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <text x="315" y="106" font-size="11" font-family="SimSun" text-anchor="middle">母液</text>
        <line x1="346" y1="62" x2="368" y2="62" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <rect x="368" y="49" width="46" height="26" fill="#ffffff" stroke="#000000" stroke-width="1.1"/>
        <text x="391" y="66" font-size="12" font-family="SimSun" text-anchor="middle">溶解</text>
        <text x="391" y="24" font-size="11" font-family="SimSun" text-anchor="middle">水</text>
        <line x1="391" y1="28" x2="391" y2="49" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <line x1="414" y1="62" x2="436" y2="62" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <rect x="436" y="49" width="46" height="26" fill="#ffffff" stroke="#000000" stroke-width="1.1"/>
        <text x="459" y="66" font-size="12" font-family="SimSun" text-anchor="middle">沉淀</text>
        <text x="459" y="17" font-size="10.5" font-family="Times New Roman, SimSun" text-anchor="middle">TiCl<tspan dy="2" font-size="8">4</tspan></text>
        <text x="459" y="31" font-size="10" font-family="Times New Roman, SimSun" text-anchor="middle">(NH<tspan dy="2" font-size="7.5">4</tspan><tspan dy="-2">)₂C₂O₄</tspan></text>
        <line x1="459" y1="35" x2="459" y2="49" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <line x1="459" y1="75" x2="459" y2="94" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <text x="459" y="106" font-size="11" font-family="SimSun" text-anchor="middle">滤液</text>
        <line x1="482" y1="62" x2="504" y2="62" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <rect x="504" y="49" width="56" height="26" fill="#ffffff" stroke="#000000" stroke-width="1.1"/>
        <text x="532" y="66" font-size="12" font-family="SimSun" text-anchor="middle">热分解</text>
        <line x1="560" y1="62" x2="588" y2="62" stroke="#000000" stroke-width="1.1" marker-end="url(#arr)"/>
        <text x="592" y="66" font-size="12" font-family="Times New Roman, SimSun">BaTiO<tspan dy="2" font-size="9">3</tspan></text>
      </svg>
    </div>
    <div class="sub-prompt">回答下列问题：</div>
    <div class="sub-item">(1) “焙烧”步骤中碳粉的主要作用是 <span class="blank blank-lg"></span>。</div>
    <div class="sub-item">(2) “焙烧”后固体产物有 $\\text{BaCl}_2$、易溶于水的 $\\text{BaS}$ 和微溶于水的 $\\text{CaS}$。“浸取”时主要反应的离子方程式为 <span class="blank blank-xl"></span>。</div>
    <div class="sub-item">(3) “酸化”步骤应选用的酸是 <span class="blank blank-sm"></span>（填标号）。</div>
    <div class="options">
      <span>a. 稀硫酸</span>
      <span>b. 浓硫酸</span>
      <span>c. 盐酸</span>
      <span>d. 磷酸</span>
    </div>
    <div class="sub-item">(4) 如果焙烧后的产物直接用酸浸取，是否可行？其原因是 <span class="blank blank-xl"></span>。</div>
    <div class="sub-item">(5) “沉淀”步骤中生成 $\\text{BaTiO(C}_2\\text{O}_4)_2$ 的化学方程式为 <span class="blank blank-xl"></span>。</div>
    <div class="sub-item">(6) “热分解”生成粉状钛酸钡，产生的 $n(\\text{CO}_2) : n(\\text{CO}) =$ <span class="blank blank-md"></span>。</div>
  </div>
</div>`,
    stem_clean_text: '进料 BaSO4 过量碳粉 过量氯化钙 焙烧 浸取 酸化 浓缩结晶 溶解 沉淀 热分解 生成粉状钛酸钡 回答下列问题 (1) 焙烧步骤中碳粉的主要作用是 (2) 浸取时主要反应的离子方程式 (3) 酸化步骤应选用的酸 (4) 沉淀步骤生成BaTiO(C2O4)2化学方程式',
    difficulty: 4,
    importance: 5,
  },
  {
    uuid: 'math-derivative-20260916-002',
    subject: '数学',
    type: '单选',
    date: '20260916',
    summary: '导数单调区间与零点综合判断',
    raw_html: `<div class="naosu-problem" subject="数学" type="单选" date="20260916" summary="导数单调区间与零点综合判断" uuid="math-derivative-20260916-002">
  <div class="problem-body">
    <div>已知函数 $f(x) = x \\text{e}^x - a x^2$，若 $f(x)$ 在区间 $(0, +\\infty)$ 上存在单调递减区间，且关于 $x$ 的方程 $f(x) = 0$ 恰有两个不相等的实数根，则实数 $a$ 的取值范围是 <span class="blank blank-sm"></span>。</div>
    <div class="options">
      <span>A. $(0, \\frac{\\text{e}}{2})$</span>
      <span>B. $(\\frac{\\text{e}}{2}, +\\infty)$</span>
      <span>C. $(1, \\text{e})$</span>
      <span>D. $(0, 1)$</span>
    </div>
  </div>
</div>`,
    stem_clean_text: '已知函数 f(x) = x e^x - a x^2，若 f(x) 在区间 (0, +inf) 上存在单调递减区间，且方程 f(x) = 0 恰有两个不相等的实数根，则实数 a 的取值范围是',
    difficulty: 3,
    importance: 4,
  },
  {
    uuid: 'phy-induction-20260916-003',
    subject: '物理',
    type: '简答',
    date: '20260916',
    summary: '双棒磁感应动量与能量分析',
    raw_html: `<div class="naosu-problem" subject="物理" type="简答" date="20260916" summary="双棒磁感应动量与能量分析" uuid="phy-induction-20260916-003">
  <div class="problem-body">
    <div class="img">
      <svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">
        <line x1="30" y1="35" x2="370" y2="35" stroke="#000" stroke-width="1.8"/>
        <line x1="30" y1="85" x2="370" y2="85" stroke="#000" stroke-width="1.8"/>
        <line x1="110" y1="20" x2="110" y2="100" stroke="#000" stroke-width="3"/>
        <text x="110" y="15" font-size="12" font-family="serif" text-anchor="middle">a</text>
        <text x="110" y="115" font-size="12" font-family="serif" text-anchor="middle">b</text>
        <line x1="260" y1="20" x2="260" y2="100" stroke="#000" stroke-width="3"/>
        <text x="260" y="15" font-size="12" font-family="serif" text-anchor="middle">c</text>
        <text x="260" y="115" font-size="12" font-family="serif" text-anchor="middle">d</text>
        <line x1="125" y1="60" x2="165" y2="60" stroke="#000" stroke-width="1.4"/>
        <polygon points="165,57 172,60 165,63" fill="#000"/>
        <text x="145" y="52" font-size="11" font-family="serif">v₀</text>
        <text x="50" y="65" font-size="14" font-family="serif">×</text>
        <text x="200" y="65" font-size="14" font-family="serif">×</text>
        <text x="340" y="65" font-size="14" font-family="serif">×</text>
        <text x="355" y="25" font-size="12" font-family="serif">B</text>
      </svg>
    </div>
    <div>两根光滑平行的水平金属导轨间距为 $L$，处于磁感应强度为 $B$ 的匀强磁场中。质量均为 $m$、电阻均为 $R$ 的金属棒 $ab$ 和 $cd$ 垂直跨放。$t=0$ 时刻棒 $ab$ 获得初速度 $v_0$ 向右滑动，导轨电阻不计。</div>
    <div class="sub-prompt">求：</div>
    <div class="sub-item">(1) 棒 $ab$ 刚开始运动时所受安培力大小 $F = $ <span class="blank blank-md"></span>。</div>
    <div class="sub-item">(2) 两棒最终达到的共同稳定速度 $v_{\\text{共}} = $ <span class="blank blank-sm"></span>。</div>
    <div class="sub-item">(3) 整个运动过程中回路产生的焦耳热 $Q = $ <span class="blank blank-md"></span>。</div>
  </div>
</div>`,
    stem_clean_text: '如图所示 两根光滑平行的足够长水平金属导轨 间距为 L 处于磁感应强度为 B 方向竖直向下的匀强磁场中 质量均为 m 电阻均为 R 的金属棒 ab 和 cd 垂直跨放在导轨上 t=0 时刻棒 ab 获得初速度 v0 向右运动',
    difficulty: 5,
    importance: 5,
  },
  {
    uuid: 'bio-genetics-20260916-004',
    subject: '生物',
    type: '多选',
    date: '20260916',
    summary: '伴性遗传系谱图综合推断',
    raw_html: `<div class="naosu-problem" subject="生物" type="多选" date="20260916" summary="伴性遗传系谱图综合推断" uuid="bio-genetics-20260916-004">
  <div class="problem-body">
    <div class="img">
      <svg viewBox="0 0 320 110" xmlns="http://www.w3.org/2000/svg">
        <text x="20" y="35" font-size="12" font-family="serif">Ⅰ</text>
        <rect x="50" y="22" width="20" height="20" fill="#fff" stroke="#000" stroke-width="1.4"/>
        <line x1="70" y1="32" x2="110" y2="32" stroke="#000" stroke-width="1.2"/>
        <circle cx="120" cy="32" r="10" fill="#000" stroke="#000"/>
        <text x="20" y="85" font-size="12" font-family="serif">Ⅱ</text>
        <line x1="90" y1="32" x2="90" y2="55" stroke="#000" stroke-width="1.2"/>
        <line x1="60" y1="55" x2="200" y2="55" stroke="#000" stroke-width="1.2"/>
        <line x1="60" y1="55" x2="60" y2="72" stroke="#000" stroke-width="1.2"/>
        <circle cx="60" cy="82" r="10" fill="#fff" stroke="#000" stroke-width="1.4"/>
        <line x1="130" y1="55" x2="130" y2="72" stroke="#000" stroke-width="1.2"/>
        <rect x="120" y="72" width="20" height="20" fill="#000" stroke="#000"/>
        <line x1="200" y1="55" x2="200" y2="72" stroke="#000" stroke-width="1.2"/>
        <circle cx="200" cy="82" r="10" fill="#fff" stroke="#000" stroke-width="1.4"/>
        <line x1="210" y1="82" x2="240" y2="82" stroke="#000" stroke-width="1.2"/>
        <rect x="240" y="72" width="20" height="20" fill="#fff" stroke="#000" stroke-width="1.4"/>
      </svg>
    </div>
    <div>如图为某种单基因遗传病的家系图。已知 $\\text{I-2}$ 患病，经医学检验 $\\text{II-4}$ 不携带该病的致病基因。在不考虑基因突变和染色体畸变的前提下，下列分析正确的有 <span class="blank blank-md"></span>。</div>
    <div class="options">
      <span>A. 该病为伴 X 染色体隐性遗传病</span>
      <span>B. $\\text{II-1}$ 与 $\\text{II-3}$ 基因型相同的概率为 $1$</span>
      <span>C. $\\text{II-3}$ 与 $\\text{II-4}$ 婚配，生出患病女孩的概率为 $1/4$</span>
      <span>D. 若胎儿性别为男，则 $\\text{III-1}$ 患病的概率为 $1/2$</span>
    </div>
  </div>
</div>`,
    stem_clean_text: '如图为某单基因遗传病的系谱图 正常男女与患病男女 经基因检测发现 II-4 不携带该致病基因 下列叙述正确的有',
    difficulty: 4,
    importance: 3,
  },
  {
    uuid: 'math-fillblank-20260919-005',
    subject: '数学',
    type: '填空',
    date: '20260919',
    summary: '抛物线焦点弦性质与通径计算',
    raw_html: `<div class="naosu-problem" subject="数学" type="填空" date="20260919" summary="抛物线焦点弦性质与通径计算" uuid="math-fillblank-20260919-005">
  <div class="problem-body">
    <div>已知抛物线 $C: y^2 = 4x$ 的焦点为 $F$，过点 $F$ 的直线与抛物线 $C$ 交于 $A, B$ 两点。若 $|AF| = 3$，则线段 $AB$ 的中点到准线的距离为 <span class="blank blank-md"></span>；线段 $AB$ 的长度为 <span class="blank blank-sm"></span>。</div>
  </div>
</div>`,
    stem_clean_text: '已知抛物线 C: y^2 = 4x 的焦点为 F，过点 F 的直线与抛物线 C 交于 A, B 两点。若 |AF| = 3，则线段 AB 的中点到准线的距离为；线段 AB 的长度为',
    difficulty: 3,
    importance: 4,
  },
];
