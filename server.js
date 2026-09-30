const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'data.json');
const INDEX = path.join(ROOT, 'index.html');

const DEFAULT_DB = { users: [] };
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { users: [] }; }
}
function writeDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function hash(password) { return crypto.createHash('sha256').update(password).digest('hex'); }
function token() { return crypto.randomBytes(32).toString('hex'); }
function json(res, status, data, extra={}) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...extra});
  res.end(JSON.stringify(data));
}
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1_000_000) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
function emailOK(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function passwordOK(p) { return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p); }
function cleanUser(u) { const {password, ...safe} = u; return safe; }
const sessions = new Map();
function getSession(req) {
  const m = (req.headers.cookie || '').match(/sb_session=([^;]+)/);
  return m ? sessions.get(m[1]) : null;
}

const CAREERS = {
  'AI & Machine Learning':['AI Engineer','Machine Learning Engineer','Deep Learning Engineer','NLP Engineer','Computer Vision Engineer','AI Research Scientist','Robotics Engineer','MLOps Engineer','Prompt Engineer','AI Product Manager','AI Solutions Architect','Generative AI Engineer'],
  'Data & Analytics':['Data Analyst','Data Scientist','Data Engineer','Analytics Engineer','Business Intelligence Analyst','BI Developer','Quantitative Analyst','Product Analyst','Marketing Analyst','Risk Analyst','Research Analyst','Data Visualization Specialist','Decision Scientist','Data Quality Analyst'],
  'Software & Web':['Software Developer','Software Engineer','Frontend Developer','Backend Developer','Full Stack Developer','Mobile App Developer','iOS Developer','Android Developer','Game Developer','Web Developer','DevOps Engineer','Platform Engineer','Cloud Engineer','Site Reliability Engineer','Embedded Software Engineer','Systems Programmer','API Developer','QA Automation Engineer'],
  'Cybersecurity':['Cybersecurity Analyst','Security Engineer','SOC Analyst','Penetration Tester','Ethical Hacker','Cloud Security Engineer','Application Security Engineer','Network Security Engineer','Security Architect','Digital Forensics Analyst','Incident Responder','GRC Analyst','Threat Intelligence Analyst','Security Operations Engineer'],
  'Cloud & Infrastructure':['Cloud Architect','Cloud Engineer','Solutions Architect','Infrastructure Engineer','Network Engineer','Systems Administrator','Database Administrator','Storage Engineer','Virtualization Engineer','IT Infrastructure Manager','Cloud FinOps Analyst','Platform Reliability Engineer'],
  'Business & Management':['Business Analyst','Product Manager','Project Manager','Program Manager','Operations Manager','Strategy Analyst','Management Consultant','Product Operations Analyst','Scrum Master','Agile Coach','Procurement Analyst','Process Improvement Analyst','Business Operations Manager'],
  'Finance & Economics':['Financial Analyst','Investment Analyst','Equity Research Analyst','Credit Analyst','Risk Manager','Actuary','Economist','Financial Planner','Treasury Analyst','FinTech Analyst','Quantitative Researcher','Portfolio Analyst','Fraud Analyst'],
  'Marketing & Sales':['Digital Marketing Specialist','SEO Specialist','SEM Specialist','Content Strategist','Social Media Manager','Brand Manager','Growth Marketer','Sales Development Representative','Account Executive','Market Research Analyst','CRM Specialist','Performance Marketing Analyst','Sales Operations Analyst'],
  'Design & Creative':['UI Designer','UX Designer','Product Designer','UX Researcher','Graphic Designer','Visual Designer','Motion Designer','3D Artist','Animator','Game Designer','Creative Director','Content Creator','Design Systems Designer','Service Designer'],
  'Healthcare & Life Sciences':['Healthcare Data Analyst','Clinical Data Manager','Bioinformatics Analyst','Medical Technologist','Public Health Analyst','Health Informatics Specialist','Clinical Research Coordinator','Pharmaceutical Analyst','Clinical Research Analyst','Medical Writer'],
  'Engineering':['Civil Engineer','Mechanical Engineer','Electrical Engineer','Electronics Engineer','Chemical Engineer','Aerospace Engineer','Automotive Engineer','Industrial Engineer','Biomedical Engineer','Environmental Engineer','Structural Engineer','Manufacturing Engineer','Mechatronics Engineer','Control Systems Engineer','Petroleum Engineer'],
  'Education & Research':['Teacher','Instructional Designer','Learning Experience Designer','Academic Researcher','Research Assistant','Education Analyst','Curriculum Developer','Technical Trainer','Educational Technologist','Assessment Specialist'],
  'Law & Compliance':['Legal Analyst','Compliance Analyst','Privacy Analyst','Regulatory Affairs Specialist','Contract Analyst','Legal Operations Specialist','Corporate Counsel','Data Protection Specialist','Regulatory Compliance Manager'],
  'Human Resources':['HR Analyst','Talent Acquisition Specialist','Recruiter','Learning & Development Specialist','Compensation Analyst','People Operations Specialist','HR Business Partner','Employee Relations Specialist','Workforce Planning Analyst'],
  'Writing & Communication':['Technical Writer','UX Writer','Copywriter','Content Writer','Editor','Science Writer','Documentation Specialist','Communications Specialist','Proposal Writer','Content Strategist'],
  'Environment & Sustainability':['Sustainability Analyst','Environmental Consultant','ESG Analyst','Climate Data Analyst','Renewable Energy Analyst','Energy Manager','Environmental Data Analyst','Sustainability Consultant','Carbon Analyst'],
  'Media & Entertainment':['Video Editor','Film Producer','Sound Designer','Broadcast Engineer','Journalist','Producer','Digital Media Specialist','Post Production Specialist','Podcast Producer','Media Planner'],
  'Public Sector & Social Impact':['Policy Analyst','Public Administration Analyst','Urban Planner','Development Program Officer','Social Impact Analyst','NGO Program Manager','Public Policy Researcher','Community Program Manager','International Development Analyst'],
  'Supply Chain & Logistics':['Supply Chain Analyst','Logistics Analyst','Demand Planner','Procurement Specialist','Inventory Analyst','Operations Research Analyst','Warehouse Manager','Transportation Analyst','Supply Chain Planner','Sourcing Analyst'],
  'Travel & Hospitality':['Travel Consultant','Hotel Operations Manager','Revenue Manager','Event Manager','Hospitality Analyst','Tourism Manager','Guest Experience Manager','Travel Operations Analyst','Resort Manager']
};

const SKILLS = {
  'AI & Machine Learning':['Python','Statistics','Machine Learning','Deep Learning','Linear Algebra','Model Evaluation','MLOps','Problem Solving'],
  'Data & Analytics':['Excel','SQL','Python','Statistics','Power BI','Data Visualization','Pandas & NumPy','Business Communication'],
  'Software & Web':['Programming Fundamentals','Data Structures & Algorithms','Git & GitHub','Databases','APIs','Testing','System Design','Problem Solving'],
  'Cybersecurity':['Networking','Linux','Python','Security Fundamentals','Web Security','Threat Analysis','Incident Response','Risk Management'],
  'Cloud & Infrastructure':['Linux','Networking','Cloud Fundamentals','Docker','Kubernetes','Infrastructure as Code','Monitoring','Security'],
  'Business & Management':['Business Analysis','Excel','SQL','Requirements Gathering','Process Mapping','Stakeholder Management','Data Visualization','Communication'],
  'Finance & Economics':['Financial Modeling','Excel','Statistics','Accounting','Risk Analysis','Data Analysis','Economics','Communication'],
  'Marketing & Sales':['Market Research','Digital Marketing','SEO/SEM','Analytics','CRM','Content Strategy','Sales','Communication'],
  'Design & Creative':['Design Fundamentals','Figma','User Research','Wireframing','Prototyping','Visual Design','Communication','Portfolio Development'],
  'Healthcare & Life Sciences':['Domain Fundamentals','Statistics','Research Methods','Data Analysis','Documentation','Regulatory Knowledge','Communication','Domain Tools'],
  'Engineering':['Engineering Fundamentals','Mathematics','CAD/Simulation','Problem Solving','Project Management','Data Analysis','Safety','Technical Communication'],
  'Education & Research':['Research Methods','Communication','Data Analysis','Curriculum Design','Presentation','Documentation','Critical Thinking','Digital Tools'],
  'Law & Compliance':['Legal Research','Documentation','Risk Analysis','Compliance','Policy Analysis','Communication','Negotiation','Critical Thinking'],
  'Human Resources':['Recruitment','HR Analytics','Communication','Employment Practices','Interviewing','Performance Management','Excel','Conflict Resolution'],
  'Writing & Communication':['Writing','Editing','Research','Communication','SEO','Content Strategy','Presentation','Digital Tools'],
  'Environment & Sustainability':['Environmental Science','Statistics','GIS','Data Analysis','Sustainability Reporting','ESG','Research','Communication'],
  'Media & Entertainment':['Storytelling','Video/Audio Tools','Editing','Creative Direction','Production','Communication','Digital Media','Portfolio Development'],
  'Public Sector & Social Impact':['Policy Research','Data Analysis','Public Administration','Program Management','Communication','Research Methods','Stakeholder Management','Report Writing'],
  'Supply Chain & Logistics':['Excel','Supply Chain Fundamentals','Inventory Management','Forecasting','Procurement','Logistics','Data Analysis','ERP Tools'],
  'Travel & Hospitality':['Customer Service','Operations','Revenue Management','Booking Systems','Communication','Marketing','Event Management','Data Analysis']
};

const FOUNDATION_SKILLS = ['Python / Programming','SQL & Data','Excel / Spreadsheets','Statistics','Problem Solving','Communication','Design & Creativity','Networking','Cloud Computing','Cybersecurity','Business Analysis','Marketing','Finance','Writing & Research','Project Management','Data Visualization'];
const CATEGORY_WEIGHTS = {
  'AI & Machine Learning':['Python / Programming','Statistics','Problem Solving','Data Visualization','Writing & Research'],
  'Data & Analytics':['SQL & Data','Excel / Spreadsheets','Python / Programming','Statistics','Data Visualization','Business Analysis'],
  'Software & Web':['Python / Programming','Problem Solving','SQL & Data','Communication','Project Management'],
  'Cybersecurity':['Cybersecurity','Networking','Python / Programming','Problem Solving','Cloud Computing'],
  'Cloud & Infrastructure':['Cloud Computing','Networking','Cybersecurity','Python / Programming','Problem Solving'],
  'Business & Management':['Business Analysis','Communication','Excel / Spreadsheets','Project Management','Data Visualization'],
  'Finance & Economics':['Finance','Excel / Spreadsheets','Statistics','SQL & Data','Business Analysis'],
  'Marketing & Sales':['Marketing','Communication','Data Visualization','Business Analysis','Writing & Research'],
  'Design & Creative':['Design & Creativity','Communication','Writing & Research','Problem Solving'],
  'Healthcare & Life Sciences':['Statistics','Research Methods','Data Visualization','Communication','Problem Solving'],
  'Engineering':['Problem Solving','Statistics','Project Management','Python / Programming','Communication'],
  'Education & Research':['Communication','Writing & Research','Statistics','Project Management','Design & Creativity'],
  'Law & Compliance':['Writing & Research','Communication','Business Analysis','Problem Solving'],
  'Human Resources':['Communication','Business Analysis','Excel / Spreadsheets','Project Management'],
  'Writing & Communication':['Writing & Research','Communication','Design & Creativity','Marketing'],
  'Environment & Sustainability':['Statistics','Data Visualization','Writing & Research','Project Management','Problem Solving'],
  'Media & Entertainment':['Design & Creativity','Communication','Marketing','Writing & Research'],
  'Public Sector & Social Impact':['Writing & Research','Communication','Business Analysis','Statistics','Project Management'],
  'Supply Chain & Logistics':['Excel / Spreadsheets','Business Analysis','Statistics','Project Management','SQL & Data'],
  'Travel & Hospitality':['Communication','Marketing','Business Analysis','Project Management','Excel / Spreadsheets']
};
function levelScore(level){ return ({Beginner:35,Intermediate:65,Advanced:90})[level] || 0; }
function recommendCategories(levels){
  return Object.entries(CATEGORY_WEIGHTS).map(([cat,keys])=>{
    const vals=keys.map(k=>levelScore(levels?.[k]));
    const score=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0;
    return {category:cat,score};
  }).sort((a,b)=>b.score-a.score).slice(0,6);
}
function careerFamilyFor(career){ return careerCategory(career); }

const JOBS = [
  {company:'Microsoft',title:'Data & Analytics Internship',type:'Internship',category:'Data & Analytics',url:'https://careers.microsoft.com/'},
  {company:'Amazon',title:'Software Development Internship',type:'Internship',category:'Software & Web',url:'https://www.amazon.jobs/'},
  {company:'Deloitte',title:'AI & Data Analyst Internship',type:'Internship',category:'Data & Analytics',url:'https://www.deloitte.com/'},
  {company:'TCS',title:'Graduate Software Engineer',type:'Job',category:'Software & Web',url:'https://www.tcs.com/careers'},
  {company:'Accenture',title:'Cybersecurity Analyst Internship',type:'Internship',category:'Cybersecurity',url:'https://www.accenture.com/in-en/careers'},
  {company:'Infosys',title:'Cloud & Systems Internship',type:'Internship',category:'Cloud & Infrastructure',url:'https://www.infosys.com/careers/'},
  {company:'EY',title:'Business Analyst Internship',type:'Internship',category:'Business & Management',url:'https://www.ey.com/en_in/careers'},
  {company:'KPMG',title:'Finance & Risk Analyst Internship',type:'Internship',category:'Finance & Economics',url:'https://kpmg.com/in/en/home/careers.html'},
  {company:'Adobe',title:'UX / Product Design Internship',type:'Internship',category:'Design & Creative',url:'https://www.adobe.com/careers.html'},
  {company:'Siemens',title:'Engineering Graduate Internship',type:'Internship',category:'Engineering',url:'https://www.siemens.com/global/en/company/jobs.html'},
  {company:'DHL',title:'Supply Chain Analyst Internship',type:'Internship',category:'Supply Chain & Logistics',url:'https://group.dhl.com/en/careers.html'},
  {company:'Unilever',title:'Marketing & Growth Internship',type:'Internship',category:'Marketing & Sales',url:'https://careers.unilever.com/'},
  {company:'IBM',title:'AI / ML Engineering Internship',type:'Internship',category:'AI & Machine Learning',url:'https://www.ibm.com/careers/'},
  {company:'Cisco',title:'Network & Security Internship',type:'Internship',category:'Cybersecurity',url:'https://jobs.cisco.com/'},
  {company:'PwC',title:'Risk & Compliance Internship',type:'Internship',category:'Law & Compliance',url:'https://www.pwc.in/careers.html'}
];

function careerCategory(career) { return Object.keys(CAREERS).find(k => CAREERS[k].includes(career)) || null; }
function skillsForCareer(career) { return SKILLS[careerCategory(career)] || ['Communication','Problem Solving','Digital Literacy','Data Analysis','Project Management','Research','Presentation','Professional Skills']; }

const server = http.createServer(async (req,res) => {
  try {
    const p = new URL(req.url, `http://${req.headers.host || HOST}`).pathname;
    if (req.method === 'GET' && p === '/') { res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}); return res.end(fs.readFileSync(INDEX)); }
    if (req.method === 'GET' && p === '/api/health') return json(res,200,{ok:true,service:'SkillBridge',version:'4.0'});
    if (req.method === 'GET' && p === '/api/catalog') return json(res,200,{careers:CAREERS,skills:SKILLS,jobs:JOBS,foundationSkills:FOUNDATION_SKILLS});

    if (req.method === 'POST' && p === '/api/signup') {
      const b = await parseBody(req), name=String(b.name||'').trim(), email=String(b.email||'').trim().toLowerCase(), password=String(b.password||'');
      if (name.length < 2) return json(res,400,{error:'⚠ Please enter your full name.'});
      if (!emailOK(email)) return json(res,400,{error:'⚠ Invalid email address.'});
      if (!passwordOK(password)) return json(res,400,{error:'⚠ Password needs 8+ characters, uppercase, lowercase, number and special character.'});
      const db=readDB(); if (db.users.some(u=>u.email===email)) return json(res,409,{error:'⚠ This email is already registered. Please sign in.'});
      const u={id:crypto.randomUUID(),name,email,password:hash(password),profile:{phone:'',degree:'B.Tech CSE',year:'4th Year',college:'',career:''},foundationLevels:{},recommendations:[],assignments:{},skills:{},history:[],roadmap:{},saved:[],createdAt:new Date().toISOString()};
      db.users.push(u); writeDB(db); const t=token(); sessions.set(t,u.id); res.setHeader('Set-Cookie',`sb_session=${t}; HttpOnly; SameSite=Lax; Path=/`); return json(res,201,{user:cleanUser(u),next:'foundation'});
    }
    if (req.method === 'POST' && p === '/api/login') {
      const b=await parseBody(req), email=String(b.email||'').trim().toLowerCase(), password=String(b.password||'');
      if (!emailOK(email)) return json(res,400,{error:'⚠ Invalid email address.'});
      const db=readDB(),u=db.users.find(x=>x.email===email); if(!u) return json(res,401,{error:'⚠ Email not found. Create an account first.'});
      if(u.password!==hash(password)) return json(res,401,{error:'⚠ Incorrect password.'});
      const t=token(); sessions.set(t,u.id); res.setHeader('Set-Cookie',`sb_session=${t}; HttpOnly; SameSite=Lax; Path=/`); return json(res,200,{user:cleanUser(u),next:u.profile.career?'dashboard':(Object.keys(u.foundationLevels||{}).length?'career':'foundation')});
    }
    if (req.method === 'POST' && p === '/api/logout') { const m=(req.headers.cookie||'').match(/sb_session=([^;]+)/); if(m)sessions.delete(m[1]); res.setHeader('Set-Cookie','sb_session=; Max-Age=0; Path=/'); return json(res,200,{ok:true}); }

    const uid=getSession(req); if(!uid) return json(res,401,{error:'Session expired. Please sign in again.'});
    const db=readDB(),u=db.users.find(x=>x.id===uid); if(!u) return json(res,401,{error:'User not found.'});
    if(req.method==='GET'&&p==='/api/me') return json(res,200,{user:cleanUser(u)});
    if(req.method==='PUT'&&p==='/api/profile'){const b=await parseBody(req);u.profile={...u.profile,phone:String(b.phone||''),degree:String(b.degree||''),year:String(b.year||''),college:String(b.college||''),career:String(b.career||'')};writeDB(db);return json(res,200,{user:cleanUser(u)});}
    if(req.method==='PUT'&&p==='/api/foundation'){const b=await parseBody(req);const levels=b.levels||{};u.foundationLevels=levels;u.recommendations=recommendCategories(levels);writeDB(db);return json(res,200,{user:cleanUser(u),recommendations:u.recommendations});}
    if(req.method==='PUT'&&p==='/api/assessment'){const b=await parseBody(req);u.profile.career=String(b.career||u.profile.career);u.assignmentLevels=b.levels||{};u.assignments=Object.fromEntries(Object.entries(u.assignmentLevels).map(([k,v])=>[k,levelScore(v)]));u.skills=Object.fromEntries(Object.entries(u.assignmentLevels).map(([k,v])=>[k,v]));const vals=Object.values(u.assignments).map(Number).filter(Number.isFinite);const readiness=vals.length?Math.round(vals.reduce((a,x)=>a+x,0)/vals.length):0;u.history.unshift({date:new Date().toISOString(),career:u.profile.career,readiness,levels:u.assignmentLevels});u.history=u.history.slice(0,30);writeDB(db);return json(res,200,{user:cleanUser(u),readiness});}
    if(req.method==='PUT'&&p==='/api/roadmap'){const b=await parseBody(req);u.roadmap=b.roadmap||{};writeDB(db);return json(res,200,{ok:true});}
    return json(res,404,{error:'Not found'});
  } catch(e) { console.error(e); return json(res,500,{error:'Server error: '+e.message}); }
});
server.on('error', e => { console.error(e); process.exit(1); });
server.listen(PORT,HOST,()=>console.log(`SkillBridge V4 running at http://${HOST}:${PORT}`));
