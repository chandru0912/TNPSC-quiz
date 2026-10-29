const fs = require('fs');
function walk(d){
  try{
    for(const f of fs.readdirSync(d)){
      const p = d+'/'+f;
      const st = fs.statSync(p);
      if(st.isDirectory() && f !== 'node_modules') walk(p);
      else if(st.isFile()){
        const c = fs.readFileSync(p,'utf8');
        if(/cors/i.test(c)){ console.log(p); process.exit(0); }
      }
    }
  }catch(e){}
}
walk('backend/src');
console.log('no');
process.exit(0);
