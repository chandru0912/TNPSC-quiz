const fs = require('fs');
function walk(d){
  try{
    for(const f of fs.readdirSync(d)){
      const p = d+'/'+f;
      const st = fs.statSync(p);
      if(st.isDirectory() && f !== 'node_modules' && f !== '.git') walk(p);
      else if(st.isFile()){
        const c = fs.readFileSync(p,'utf8');
        if(/CREATE TABLE/i.test(c) && /(user|attempt|progress|result)/i.test(c)){ console.log(p); }
      }
    }
  }catch(e){}
}
walk('.');
console.log('done');
process.exit(0);
