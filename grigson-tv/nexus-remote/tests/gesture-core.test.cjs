const {test}=require('node:test');
const assert=require('node:assert/strict');
const gestures=require('../gesture-core.js');
test('one swipe names one direction, once it is clearly past the threshold',()=>{
  for(const [x,y,d] of [[60,3,'right'],[-60,3,'left'],[3,60,'down'],[3,-60,'up']])
    assert.equal(gestures.swipeDirection(x,y),d);
  assert.equal(gestures.swipeDirection(29,0),null);
  assert.equal(gestures.swipeDirection(300,0),'right','a long swipe is still one direction, not many');
});
test('diagonals and micro-movement do not choose an arbitrary direction',()=>{
  assert.equal(gestures.swipeDirection(60,60),null);
  assert.equal(gestures.swipeDirection(-60,60),null);
  assert.equal(gestures.swipeDirection(12,0),null);
});
test('a normal swipe earns no extra press; only a long one earns one or two',()=>{
  assert.equal(gestures.extraSteps(80),0);
  assert.equal(gestures.extraSteps(139),0);
  assert.equal(gestures.extraSteps(140),1);
  assert.equal(gestures.extraSteps(230),2);
  assert.equal(gestures.extraSteps(900),2,'never more than two extras');
  assert.equal(gestures.extraSteps(-120),0,'a reversal earns nothing');
});
test('drag release and long hold never become a tap-select',()=>{
  assert.equal(gestures.isTap(false,200),true);
  assert.equal(gestures.isTap(true,200),false);
  assert.equal(gestures.isTap(false,600),false);
});
test('volume never exceeds device demo limits',()=>{
  assert.equal(gestures.clampVolume(-1),0);
  assert.equal(gestures.clampVolume(101),100);
  assert.equal(gestures.clampVolume(19),19);
});
