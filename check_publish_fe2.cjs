const fs = require('fs');
function walk(d){
  for(const f of fs.readdirSync(d)){
    const p = d+'/'+f;
    const st = fs.statSync(p);
    if(st.isDirectory() && f!=='node_modules') walk(p);
    else if(st.isFile() && (p.endsWith('.tsx')||p.endsWith('.ts'))){
      const c = fs.readFileSync(p,'utf8');
      if(c.includes('publish')){
        console.log(p.replace('src/','src/'));
      }
    }
  }
}
walk('src');
