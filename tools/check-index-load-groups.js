const fs = require('fs');
const path = require('path');
const { INDEX_LOAD_GROUPS } = require('./index-load-groups');

function stripQuery(src){
  return String(src || '').replace(/\?.*$/, '');
}

function parseScriptTags(html){
  const regex = /<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi;
  const out = [];
  let match;
  while((match = regex.exec(html))){
    const attrs = `${match[1]} ${match[3]}`;
    const groupMatch = attrs.match(/data-load-group=["']([^"']+)["']/i);
    out.push({
      src: match[2],
      baseSrc: stripQuery(match[2]),
      group: groupMatch ? groupMatch[1] : '',
    });
  }
  return out;
}

function flattenConfig(){
  const ordered = [];
  INDEX_LOAD_GROUPS.forEach((group)=>{
    group.scripts.forEach((script)=>{
      ordered.push({ group: group.id, baseSrc: script });
    });
  });
  return ordered;
}

function verifyIndex(indexPath){
  const html = fs.readFileSync(indexPath, 'utf8');
  const actual = parseScriptTags(html);
  const expected = flattenConfig();
  const errors = [];

  if(actual.length !== expected.length){
    errors.push(`Liczba skryptów nie zgadza się z configiem: index=${actual.length}, config=${expected.length}`);
  }

  const min = Math.min(actual.length, expected.length);
  for(let i = 0; i < min; i += 1){
    const a = actual[i];
    const e = expected[i];
    if(a.baseSrc !== e.baseSrc){
      errors.push(`Pozycja ${i + 1}: index ma ${a.baseSrc}, config oczekuje ${e.baseSrc}`);
    }
    if(a.group !== e.group){
      errors.push(`Pozycja ${i + 1}: ${a.baseSrc} ma data-load-group=${a.group || '(brak)'}, oczekiwano ${e.group}`);
    }
  }

  const seenOrder = [];
  let lastGroup = null;
  actual.forEach((item)=>{
    if(item.group !== lastGroup){
      seenOrder.push(item.group);
      lastGroup = item.group;
    }
  });
  const expectedOrder = INDEX_LOAD_GROUPS.map((group)=> group.id);
  if(JSON.stringify(seenOrder) !== JSON.stringify(expectedOrder)){
    errors.push(`Kolejność grup w index nie jest spójna. Actual=${seenOrder.join(' -> ')}, expected=${expectedOrder.join(' -> ')}`);
  }

  return { actual, errors };
}

if(require.main === module){
  const target = process.argv[2] || path.join(process.cwd(), 'index.html');
  const result = verifyIndex(target);
  if(result.errors.length){
    console.error('Index load-group audit: FAIL');
    result.errors.forEach((error)=> console.error(`- ${error}`));
    process.exit(1);
  }
  console.log('Index load-group audit: OK');
  INDEX_LOAD_GROUPS.forEach((group)=>{
    console.log(`- ${group.id}: ${group.scripts.length} skryptów`);
  });
}

module.exports = { verifyIndex };
