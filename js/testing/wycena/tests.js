(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  const FX = FC.wycenaTestFixtures;
  if(!FX || typeof FX.clone !== 'function' || typeof FX.withInvestorProjectFixture !== 'function') throw new Error('Brak FC.wycenaTestFixtures');
  const clone = FX.clone;
  const withInvestorProjectFixture = FX.withInvestorProjectFixture;

  function collectRegisteredTests(){
    const providers = Array.isArray(FC.wycenaTestRegistry) ? FC.wycenaTestRegistry.slice() : [];
    return providers.flatMap((provider)=> {
      const rows = provider({ FC, H, clone, withInvestorProjectFixture });
      return Array.isArray(rows) ? rows : [];
    });
  }

  function runAll(){
    return H.runSuite('WYCENA smoke testy', collectRegisteredTests());
  }

  FC.wycenaDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
