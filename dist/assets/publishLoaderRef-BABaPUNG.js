const r=/@v(\d+)$/;function o(t){const e=t.trim(),n=r.exec(e);return n?{componentPath:e.slice(0,-n[0].length),publishedVersion:Number(n[1])}:{componentPath:e}}export{o as p};
