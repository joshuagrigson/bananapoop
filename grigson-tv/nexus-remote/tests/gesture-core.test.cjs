const {test}=require('node:test');
const assert=require('node:assert/strict');
const gestures=require('../gesture-core.js');
test('each cardinal swipe maps to its intended TV direction',()=>{
  for(const [x,y,d] of [[60,3,'right'],[-60,3,'left'],[3,60,'down'],[3,-60,'up']])
    assert.deepEqual(gestures.step(x,y),{count:2,direction:d});
});
test('diagonals and micro-movement do not choose an arbitrary direction',()=>{
  assert.equal(gestures.step(60,60),null);
  assert.equal(gestures.step(-60,60),null);
  assert.equal(gestures.step(25,0),null);
});
test('large movements are bounded per input event',()=>assert.equal(gestures.step(1000,0).count,4));
test('drag release and long hold never become a tap-select',()=>{
  assert.equal(gestures.isTap(false,200),true);
  assert.equal(gestures.isTap(true,200),false);
  assert.equal(gestures.isTap(false,600),false);
});
test('fast flick is capped; slow or stale release has no inertia',()=>{
  assert.equal(gestures.flickSteps(50,true),3);
  assert.equal(gestures.flickSteps(.2,true),0);
  assert.equal(gestures.flickSteps(2,false),0);
});
test('volume never exceeds device demo limits',()=>{
  assert.equal(gestures.clampVolume(-1),0);
  assert.equal(gestures.clampVolume(101),100);
  assert.equal(gestures.clampVolume(19),19);
});
