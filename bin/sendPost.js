#!/usr/bin/env node

function usage() {
  console.error('Usage : createPost.js <webid> <message> [application]');
}

if (!process.argv[2]) {
  console.error('Webid is required');
  usage();
  process.exit(-1);
}

if (!process.argv[3]) {
  console.error('Message is required');
  usage();
  process.exit(-1);
}

var webid = process.argv[2];
var message = process.argv[3];
var application = process.argv[4];

function createPost(webid, message, application) {
  var turtle;
  turtle += '<#this> ';
  turtle += '    <http://purl.org/dc/terms/created> "'+ new Date().toISOString() +'"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;\n';
  turtle += '    <http://purl.org/dc/terms/creator> <' + webid + '> ;\n';
  turtle += '    <http://rdfs.org/sioc/ns#content> "'+ message.trim() +'" ;\n';
  turtle += '    a <http://rdfs.org/sioc/ns#Post> ;\n';

  if (application) {
    turtle += '    <https://w3.org/ns/solid/app#application> <' + application + '> ;\n';    
  }

  turtle += '    <http://www.w3.org/ns/mblog#author> <'+ webid +'> .\n';
  return turtle;
}

console.log(createPost(webid, message, application));
