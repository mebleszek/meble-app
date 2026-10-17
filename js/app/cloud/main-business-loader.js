// One ordered loader for the inert startup manifest and later local JS/recovery.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  function create(assertAccess,onFailure){
    const append=Node.prototype.appendChild,insert=Node.prototype.insertBefore;
    const tasks=new WeakMap(),cache=new Map();let aborted=false;
    const controller=new AbortController();
    function source(src){
      const url=new URL(src,document.baseURI);
      if(url.origin!==location.origin||!url.pathname.startsWith(new URL('js/',document.baseURI).pathname))throw Error('AUTH_SCRIPT_SOURCE');
      return url.href;
    }
    function code(src){
      const url=source(src);assertAccess();
      if(!cache.has(url))cache.set(url,fetch(url,{signal:controller.signal,credentials:'same-origin'}).then(r=>{
        if(!r.ok)throw Error('AUTH_SCRIPT_NETWORK');return r.text();
      }).catch(error=>{cache.delete(url);throw error;}));
      return cache.get(url);
    }
    function execute(parent,node,before,src){
      const pending=(async()=>{
        const text=await code(src);assertAccess();if(aborted)throw Error('AUTH_SCRIPT_ABORTED');
        node.removeAttribute('src');node.setAttribute('data-loaded-src',src);
        // Preserve the original source contract used by boot and dependency retries.
        const get=node.getAttribute.bind(node);
        node.getAttribute=name=>name==='src'?src:get(name);
        Object.defineProperty(node,'src',{get:()=>source(src)});
        node.textContent=text+'\n//# sourceURL='+source(src);
        let scriptError=null;
        const capture=event=>{scriptError=event.error||Error('AUTH_SCRIPT_EXECUTION');};
        window.addEventListener('error',capture);
        try{if(before)insert.call(parent,node,before);else append.call(parent,node);}
        finally{window.removeEventListener('error',capture);}
        if(scriptError)throw scriptError;
        node.dispatchEvent(new Event('load'));
      })().catch(error=>{node.dispatchEvent(new Event('error'));onFailure(error);throw error;});
      tasks.set(node,pending);pending.catch(()=>{});return node;
    }
    function intercepted(parent,node,before){
      const src=node?.tagName==='SCRIPT'?node.getAttribute('src'):null;
      if(src){
        const url=new URL(src,document.baseURI);
        if(url.origin===location.origin&&url.pathname.startsWith(new URL('js/',document.baseURI).pathname))return execute(parent,node,before,src);
      }
      return before?insert.call(parent,node,before):append.call(parent,node);
    }
    Node.prototype.appendChild=function(node){return intercepted(this,node,null);};
    Node.prototype.insertBefore=function(node,before){return intercepted(this,node,before);};
    return {
      async start(manifest){
        // Bounded parallel fetch; evaluation stays in the exact manifest order.
        let cursor=0;
        await Promise.all(Array.from({length:8},async()=>{while(cursor<manifest.length){const entry=manifest[cursor++];await code(entry.src);}}));
        for(const entry of manifest){
          assertAccess();const script=document.createElement('script');script.src=entry.src;script.async=false;
          script.setAttribute('data-load-group',entry.group);document.head.appendChild(script);await tasks.get(script);
        }
      },
      abort(){aborted=true;controller.abort();}
    };
  }
  FC.mainBusinessLoader={create};
})();
