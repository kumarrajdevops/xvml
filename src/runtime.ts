export const XVML_RUNTIME = `
(function(){
  var s={},pk=null;
  function _get(o,p){return p.split('.').reduce(function(a,k){return a==null?a:a[k];},o);}
  // Resolve a path against the loop-scope chain (innermost first), then global state.
  // Inside @each item in xs: 'item' = element, 'item.x' = property, 'item__index' = index.
  function _sc(p,sc){
    for(var i=sc.length-1;i>=0;i--){
      if(p===sc[i].n)return sc[i].v;
      if(p===sc[i].n+'__index')return sc[i].i;
      if(p.indexOf(sc[i].n+'.')===0)return _get(sc[i].v,p.slice(sc[i].n.length+1));
    }
    return _get(s,p);
  }
  function _lit(t){
    t=t.trim();
    if(t==='true')return true;
    if(t==='false')return false;
    if(t==='null')return null;
    if(t!==''&&!isNaN(Number(t)))return Number(t);
    var q=t.match(/^'(.*)'$/)||t.match(/^"(.*)"$/);
    return q?q[1]:t;
  }
  // Evaluate a data-xi condition: key | !key | !(expr) | key OP literal
  function _ev(e,sc){
    e=e.trim();
    if(e.slice(0,2)==='!('&&e.slice(-1)===')')return !_ev(e.slice(2,-1),sc);
    var m=e.match(/^(.+?)\\s*(==|!=|>=|<=|>|<)\\s*(.+)$/);
    if(m){
      var l=_sc(m[1].trim(),sc),r=_lit(m[3]);
      switch(m[2]){
        case'==':return l==r;
        case'!=':return l!=r;
        case'>':return l>r;
        case'<':return l<r;
        case'>=':return l>=r;
        case'<=':return l<=r;
      }
    }
    var n=e[0]==='!';
    return (!!_sc(n?e.slice(1):e,sc))!==n;
  }
  // Elements matching sel under root, excluding those inside a nested data-xe
  // (loop content is rebuilt by its own @each pass with the right scope).
  function _own(root,sel){
    return Array.prototype.filter.call(root.querySelectorAll(sel),function(el){
      var p=el.parentElement&&el.parentElement.closest('[data-xe]');
      return !(p&&p!==root&&root.contains(p));
    });
  }
  function _proc(root,sc){
    _own(root,'[data-xi]').forEach(function(el){
      el.style.display=_ev(el.dataset.xi,sc)?'':'none';
    });
    _own(root,'[data-xv]').forEach(function(el){
      var v=_sc(el.dataset.xv,sc);
      el.textContent=v!==undefined?String(v):'';
    });
    _own(root,'[data-xb]').forEach(function(el){
      if(el===document.activeElement)return;
      var v=_sc(el.dataset.xb,sc);
      if(el.type==='checkbox')el.checked=!!v;
      else el.value=v!==undefined?v:'';
    });
    // data-xattr="attr1:path1;attr2:path2" — bind element attributes to state.
    // A leading ! on the path negates truthiness (bind:disabled=!loggedIn).
    _own(root,'[data-xattr]').forEach(function(el){
      el.dataset.xattr.split(';').forEach(function(pair){
        var ci=pair.indexOf(':'),a=pair.slice(0,ci),k=pair.slice(ci+1),
            v=k[0]==='!'?!_sc(k.slice(1),sc):_sc(k,sc);
        if(a==='class'){
          if(el.__xbc===undefined)el.__xbc=el.className;
          el.className=el.__xbc+(v?' '+String(v):'');
        }else if(v===true)el.setAttribute(a,'');
        else if(v===false||v===undefined||v===null)el.removeAttribute(a);
        else el.setAttribute(a,String(v));
      });
    });
    _own(root,'[data-xe]').forEach(function(el){
      // skip rebuild only while the user is typing in a text field inside this
      // loop — buttons/checkboxes inside it must still trigger a redraw
      var ae=document.activeElement;
      if(ae&&el.contains(ae)&&(ae.tagName==='TEXTAREA'||
        (ae.tagName==='INPUT'&&ae.type!=='checkbox'&&ae.type!=='radio')))return;
      var arr=_sc(el.dataset.xe,sc),iname=el.dataset.xei;
      var t=el.querySelector('template'),c=el.querySelector('[data-xec]');
      if(!t||!c)return;
      c.innerHTML='';
      if(!Array.isArray(arr))return;
      arr.forEach(function(v,i){
        var h=document.createElement('div');
        h.appendChild(document.importNode(t.content,true));
        var sc2=sc.concat([{n:iname,v:v,i:i}]);
        // interpolate {path} placeholders in event handlers per item
        Array.prototype.forEach.call(h.querySelectorAll('[onclick],[onchange],[oninput]'),function(b){
          ['onclick','onchange','oninput'].forEach(function(at){
            var oc=b.getAttribute(at);
            if(oc&&oc.indexOf('{')>-1)b.setAttribute(at,oc.replace(/\\{([\\w.]+)\\}/g,function(_,p){
              return JSON.stringify(_sc(p,sc2));
            }));
          });
        });
        _proc(h,sc2);
        while(h.firstChild)c.appendChild(h.firstChild);
      });
    });
  }
  function _save(){if(pk)try{localStorage.setItem(pk,JSON.stringify(s));}catch(e){}}
  function _u(){_proc(document.body,[]);_save();}
  function set(k,v){
    var p=k.split('.'),o=s,i;
    for(i=0;i<p.length-1;i++){if(typeof o[p[i]]!=='object'||o[p[i]]===null)o[p[i]]={};o=o[p[i]];}
    o[p[p.length-1]]=v;_u();
  }
  function get(k){return _get(s,k);}
  function init(d){Object.assign(s,d);_u();}
  function push(k,v){var a=_get(s,k);if(!Array.isArray(a))a=[];a.push(v);set(k,a);}
  function removeAt(k,i){var a=_get(s,k);if(Array.isArray(a)&&i>=0){a.splice(i,1);set(k,a);}}
  function persist(k){
    pk=k;
    try{var d=localStorage.getItem(k);if(d)Object.assign(s,JSON.parse(d));}catch(e){}
    _u();
  }
  function load(u){
    return fetch(u).then(function(r){return r.json();}).then(init);
  }
  window.xvml={state:s,set:set,get:get,init:init,push:push,removeAt:removeAt,persist:persist,load:load};
})();
`.trim();
