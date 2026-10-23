import assert from 'node:assert/strict';
import test from 'node:test';
import {parseWorkflowSchedule, describeWorkflowSchedule} from './workflow-schedule.js';

test('validates weekday selection, clock time, zone and scheduled amount', () => {
  const schedule = parseWorkflowSchedule({days:[5,6,0,1,5],time:'10:00',timeZone:'Asia/Kolkata'},20);
  assert.deepEqual(schedule.days,[0,1,5,6]);
  assert.match(describeWorkflowSchedule(schedule),/Sun, Mon, Fri, Sat · 10:00/);
  assert.equal(parseWorkflowSchedule(null,0),null);
  for (const patch of [{days:[]},{days:[7]},{days:['1']},{time:'24:00'},{time:'10:60'},{timeZone:'wrong'},{enabled:'yes'}]) {
    assert.throws(()=>parseWorkflowSchedule({...schedule,...patch},20));
  }
  assert.throws(()=>parseWorkflowSchedule(schedule,0));
});
