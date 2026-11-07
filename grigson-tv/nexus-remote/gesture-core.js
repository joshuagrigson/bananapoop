/* Pure gesture decisions, shared by the browser and dependency-free Node tests. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NexusGesture=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  return Object.freeze({
    // One swipe, one move: the first clear movement past the threshold names the direction, once.
    swipeDirection(sx,sy,threshold=30,ratio=1.25){
      const horizontal=Math.abs(sx)>Math.abs(sy)*ratio;
      const vertical=Math.abs(sy)>Math.abs(sx)*ratio;
      if(!horizontal&&!vertical)return null;
      const delta=horizontal?sx:sy;
      if(Math.abs(delta)<threshold)return null;
      return horizontal?(delta>0?'right':'left'):(delta>0?'down':'up');
    },
    // Only a long swipe earns extra presses at release: +1 past 140 px, +2 past 230 px, measured
    // along the locked direction (a reversal counts as zero). Speed never counts.
    extraSteps(distanceAlong,heavy=140,veryHeavy=230){
      return distanceAlong>=veryHeavy?2:distanceAlong>=heavy?1:0;
    },
    isTap(moved,elapsed,maxMs=350){return !moved&&elapsed<=maxMs;},
    clampVolume(value){return Math.max(0,Math.min(100,Math.round(value)));}
  });
});
