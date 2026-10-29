const fs = require('fs');
function walk(d){
  try{
    for(const f of fs.readdirSync(d)){
      const p = d+'/'+f;
      const st = fs.statSync(p);
      if(st.isDirectory() && f !== 'node_modules') walk(p);
      else if(st.isFile()){
        const c = fs.readFileSync(p,'utf8');
        if(/FROM.*question|question.*FROM|test|attempt|progress|result/i.test(c)){ 
          if(p.includes('migrate')||p.includes('routes')||p.includes('db')) console.log(p); 
        }
      }
    }
  }catch(e){}
}
walk('backend/src');
console.log('done');
process.exit(0);
