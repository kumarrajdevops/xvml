export const XVML_RUNTIME = `
(function(){
  var s={};
  function set(k,v){
    var p=k.split('.'),o=s,i;
    for(i=0;i<p.length-1;i++){if(typeof o[p[i]]!=='object'||o[p[i]]===null)o[p[i]]={};o=o[p[i]];}
    o[p[p.length-1]]=v;_u();
  }
  function get(k){return _get(s,k);}
  function init(data){Object.assign(s,data);_u();}
  function _u(){
    // @if
    document.querySelectorAll('[data-xi]').forEach(function(el){
      var e=el.dataset.xi,n=e[0]==='!',k=n?e.slice(1):e;
      el.style.display=(!!_get(s,k))!==n?'':'none';
    });
    // @bind inputs
    document.querySelectorAll('[data-xb]').forEach(function(el){
      var v=_get(s,el.dataset.xb);
      if(el!==document.activeElement)el.value=v!==undefined?v:'';
    });
    // @each
    document.querySelectorAll('[data-xe]').forEach(function(el){
      var k=el.dataset.xe,iname=el.dataset.xei;
      var t=el.querySelector('template');
      var c=el.querySelector('[data-xec]');
      if(!t||!c)return;
      c.innerHTML='';
      var arr=s[k];if(!Array.isArray(arr))return;
      arr.forEach(function(v){
        var clone=document.importNode(t.content,true);
        clone.querySelectorAll('[data-xv]').forEach(function(n){
          var path=n.dataset.xv;
          var val=path.startsWith(iname+'.')?
            _get(v,path.slice(iname.length+1)):
            (path===iname?v:_get(s,path));
          n.textContent=val!==undefined?String(val):'';
        });
        c.appendChild(clone);
      });
    });
    // @var (outside @each — loop items are resolved by the @each pass above)
    document.querySelectorAll('[data-xv]').forEach(function(el){
      if(el.closest('[data-xe]'))return;
      var v=_get(s,el.dataset.xv);el.textContent=v!==undefined?String(v):'';
    });
  }
  function _get(obj,path){
    return path.split('.').reduce(function(o,k){return o&&o[k];},obj);
  }
  window.xvml={state:s,set:set,get:get,init:init};
})();
`.trim();
