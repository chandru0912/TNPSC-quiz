const fs = require('fs');
function walk(d){
  try{
    for(const f of fs.readdirSync(d)){
      const p = d+'/'+f;
      const st = fs.statSync(p);
      if(st.isDirectory() && f !== 'node_modules' && f !== '.git') walk(p);
      else if(st.isFile()){
        const c = fs.readFileSync(p,'utf8');
        if(c.includes('credentials currently unavailable')){
          console.log(p);
          const m = c.match(/.*credentials currently unavailable.*/);
          if(m) console.log(m[0]);
          process.exit(0);
        }
      }
    }
  }catch(e){}
}
walk('.');
console.log('not found');
process.exit(0);
