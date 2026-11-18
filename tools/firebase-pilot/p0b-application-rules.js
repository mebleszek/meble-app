'use strict';
// Emulator-only assembly. The checked-in release rules and activation hash are unchanged.
const fs = require('node:fs');
const path = require('node:path');
const { applicationRules } = require('./application-rules');

function p0bApplicationRules({normal=false}={}) {
  let rules = applicationRules();
  function replace(from, to) {
    if (rules.split(from).length !== 2) throw Error('LF_P0B_RULES_BASE_CHANGED: ' + from);
    rules = rules.replace(from, () => to);
  }
  replace("['ownerUid','projectId','deviceId','epoch','active','headRevision']",
    "['ownerUid','projectId','deviceId','epoch','active','headRevision','investorId','deviceLabel']");
  replace("&& (d.headRevision == '' || revisionId(d.headRevision));",
    "&& (d.headRevision == '' || revisionId(d.headRevision)) && invId(d.investorId)\n"
    + "        && d.deviceLabel is string && d.deviceLabel.size() <= 64;");
  replace("&& !exists(/databases/$(database)/documents/users/$(uid)/localFirstProjects/$(pid));",
    "&& !exists(invHeadRef(uid,pid)) && invEditorPair(uid,pid,request.resource.data);");
  replace("allow update: if globalApproved(uid) && lfEditorShape(request.resource.data,uid,pid)",
    "allow update: if globalApproved(uid) && lfEditorShape(request.resource.data,uid,pid)\n"
    + "        && request.resource.data.investorId == resource.data.investorId\n"
    + "        && (invTakeover(uid,pid,resource.data,request.resource.data) || (invEditorPair(uid,pid,request.resource.data)");
  replace("&& request.resource.data.headRevision == lfHead(uid,pid).currentRevisionId)",
    "&& request.resource.data.deviceLabel == resource.data.deviceLabel\n"
    + "          && request.resource.data.headRevision == (exists(invHeadRef(uid,pid)) ? lfHead(uid,pid).currentRevisionId : ''))");
  replace("&& resource.data.headRevision == lfHead(uid,pid).currentRevisionId));",
    "&& resource.data.headRevision == (exists(invHeadRef(uid,pid)) ? lfHead(uid,pid).currentRevisionId : '')))));");
  replace("let e = lfEditor(uid,pid);",
    "let e = getAfter(invEditorRef(uid,pid)).data;");
  replace("&& d.updatedAt == request.time && e.active == true && d.deviceId == e.deviceId",
    "&& invCanPublish(uid,d.investorId,pid) && e.investorId == d.investorId\n"
    + "        && d.updatedAt == request.time && e.active == true && d.deviceId == e.deviceId");
  replace("&& lfEditor(uid,pid).active == true && d.createdAt == request.time;",
    "&& invCanPublish(uid,d.investorId,pid) && lfEditor(uid,pid).investorId == d.investorId\n"
    + "        && lfEditor(uid,pid).active == true && d.createdAt == request.time;");
  replace("allow get: if globalApproved(uid);\n      // Owner-only bounded head discovery; no listing revisions/chunks/editors.\n      allow list: if globalApproved(uid) && request.query.limit != null && request.query.limit <= 100;",
    "allow get: if globalApproved(uid) && (resource == null || invRegistered(uid,resource.data.investorId,pid));\n"
    + "      allow list: if false;");
  replace("match /revisions/{rid} {\n        allow get: if globalApproved(uid);\n        allow create: if globalApproved(uid) && lfRevision",
    "match /revisions/{rid} {\n        allow get: if globalApproved(uid) && invRegistered(uid,lfEditor(uid,pid).investorId,pid);\n"
    + "        allow create: if globalApproved(uid) && lfRevision");
  replace("allow get: if globalApproved(uid);\n          allow create: if globalApproved(uid) && lfEditor(uid,pid).active == true",
    "allow get: if globalApproved(uid) && invRegistered(uid,lfEditor(uid,pid).investorId,pid);\n"
    + "          allow create: if globalApproved(uid) && lfEditor(uid,pid).active == true\n"
    + "            && invCanPublish(uid,lfEditor(uid,pid).investorId,pid)");
  replace('    match /{document=**}', fs.readFileSync(path.join(__dirname, 'p0b-investors.rules'), 'utf8') + '\n    match /{document=**}');
  if(normal){
    replace('    match /{document=**}',fs.readFileSync(path.join(__dirname,'p0b-room-quotes.rules'),'utf8')+'\n    match /{document=**}');
    // Normal room namespace: a removed scope is terminal; history stays readable.
    replace("'globalRevisionId','globalDirectoryHash'])","'globalRevisionId','globalDirectoryHash','roomDeleted'])");
    replace("&& d.generation is int && d.generation > 0 && revisionId(d.currentRevisionId)",
      "&& d.roomDeleted is bool && d.generation is int && d.generation > 0 && revisionId(d.currentRevisionId)");
    replace("&& d.updatedAt == request.time && e.active == true",
      "&& d.updatedAt == request.time && !roomTerminal(uid,pid) && e.active == true");
    replace("&& request.resource.data.investorId == resource.data.investorId",
      "&& request.resource.data.investorId == resource.data.investorId && (!request.resource.data.active || !roomTerminal(uid,pid))");
    replace("return inv.deletionId == '' && inv.bulkId == '' && inv.projects.get(pid,false) == true;",
      "return inv.deletionId == '' && inv.bulkId == '' && inv.projects.get(pid,false) == true && !roomTerminal(uid,pid);");
    rules=rules.replace('    function invCanPublish(uid, iid, pid) {',
      "    function roomTerminal(uid,pid) { return exists(invHeadRef(uid,pid)) && get(invHeadRef(uid,pid)).data.roomDeleted == true; }\n    function invCanPublish(uid, iid, pid) {");
  }
  if(normal)for(const [from,to] of Object.entries({localFirstInvestors:'p0bRoomInvestors',localFirstProjects:'p0bRoomProjects',localFirstEditors:'p0bRoomEditors',p0bDeletionGroups:'p0bRoomGroups'}))rules=rules.replaceAll(from,to);
  return rules;
}

module.exports = { p0bApplicationRules };
