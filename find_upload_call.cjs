const fs = require('fs');
function walk(d){
  try{
    for(const f of fs.readdirSync(d)){
      const p = d+'/'+f;
      const st = fs.statSync(p);
      if(st.isDirectory() && f !== 'node_modules') walk(p);
      else if(st.isFile()){
        const c = fs.readFileSync(p,'utf8');
        if(c.includes('/api/questions/upload')){ console.log(p); process.exit(0); }
      }
    }
  }catch(e){}
}
walk('src');
console.log('no');
process.exit(0);
