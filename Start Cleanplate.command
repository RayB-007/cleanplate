#!/bin/zsh
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
cd -- "${0:A:h}" || exit 1
if ! command -v node >/dev/null 2>&1; then
  print 'Node.js is missing. Install Node.js 22 or newer, then open this launcher again.'
  read '?Press Return to close.'
  exit 1
fi
cleanplate_url='http://localhost:4317'
if /usr/bin/curl --silent --fail --max-time 2 "$cleanplate_url/api/health" | /usr/bin/grep -q 'cleanplate'; then
  /usr/bin/open -a Safari "$cleanplate_url"
  exit 0
fi
print 'Starting Cleanplate… Keep this Terminal window open while using the site.'
PORT=4317 node server.mjs &
cleanplate_pid=$!
trap 'kill "$cleanplate_pid" 2>/dev/null' EXIT INT TERM
for cleanplate_attempt in {1..30}; do
  if ! kill -0 "$cleanplate_pid" 2>/dev/null; then
    print '\nCleanplate could not start. Copy the error above and send it in the chat.'
    read '?Press Return to close.'
    exit 1
  fi
  if /usr/bin/curl --silent --fail --max-time 1 "$cleanplate_url/api/health" | /usr/bin/grep -q 'cleanplate'; then
    print "\nReady: $cleanplate_url"
    /usr/bin/open -a Safari "$cleanplate_url"
    wait "$cleanplate_pid"
    exit $?
  fi
  /bin/sleep 0.3
done
print '\nThe server did not become ready. Copy any error above and send it in the chat.'
read '?Press Return to close.'
exit 1
