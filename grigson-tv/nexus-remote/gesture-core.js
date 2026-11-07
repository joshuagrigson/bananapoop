/* Pure gesture decisions, shared by the browser and dependency-free Node tests. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NexusGesture=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  return Object.freeze({
    step(sx,sy,threshold=26,ratio=1.25){
      const horizontal=Math.abs(sx)>Math.abs(sy)*ratio;
      const vertical=Math.abs(sy)>Math.abs(sx)*ratio;
      if(!horizontal&&!vertical)return null;
      const delta=horizontal?sx:sy;
      const count=Math.min(4,Math.floor(Math.abs(delta)/threshold));
      if(!count)return null;
      return {count,direction:horizontal?(delta>0?'right':'left'):(delta>0?'down':'up')};
    },
    isTap(moved,elapsed,maxMs=350){return !moved&&elapsed<=maxMs;},
    flickSteps(velocity,recent,minVelocity=.65,maxSteps=3){return recent&&velocity>=minVelocity?Math.min(maxSteps,Math.floor(velocity/minVelocity)):0;},
    clampVolume(value){return Math.max(0,Math.min(100,Math.round(value)));}
  });
});
