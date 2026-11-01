// Preserve the released operator's 425-pin checkout; never repin current UI.
'use strict';
const path = require('node:path');
const context = require('../cloud-ci-context.js');
function loadOperator(operatorRoot = process.env.CLOUD_CI_HISTORY_ROOT) {
  const root = context.verifyHistorical(path.resolve(__dirname, '../..'), operatorRoot);
  const authority = require(path.join(root, 'tools/firebase-pilot/cloud46e-authority.js'));
  authority.inventory();
  return {root, executionHead: context.HISTORICAL_SHA, authority,
    pilot: require(path.join(root, 'tools/firebase-pilot/cloud42-package.js'))};
}
module.exports = {loadOperator};
