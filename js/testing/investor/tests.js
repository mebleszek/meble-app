(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const harness = FC.testHarness;
  if(!harness) return;
  const { runSuite } = harness;

  function collectTests(){
    const suites = Array.isArray(FC.investorDevTestSuites) ? FC.investorDevTestSuites : [];
    return suites.reduce((all, suite)=> all.concat(Array.isArray(suite && suite.tests) ? suite.tests : []), []);
  }

  FC.investorDevTests = {
    runAll: ()=> runSuite('INWESTOR smoke testy', collectTests()),
    _debug:{ collectTests }
  };
})(typeof window !== 'undefined' ? window : globalThis);
