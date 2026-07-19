      /* ═══════════ KABAR PERISTIWA — banner naratif singkat (rout, serangan udara, jeda) ═══════════ */
      const eventTickerEl = document.getElementById('event-ticker'), etTxtEl = document.getElementById('et-txt');
      let eventTickerHide = null, lastEventAt = -1e9;
      export function showEvent(text, tone, force) {   // tone: 'buy' | 'sell' | 'neutral'
        const now = performance.now();
        if (!force && now - lastEventAt < 1500) return;   // jangan bertumpuk (kecuali peristiwa penting)
        lastEventAt = now;
        etTxtEl.textContent = text;
        eventTickerEl.className = 'show ' + (tone || 'neutral');
        clearTimeout(eventTickerHide);
        eventTickerHide = setTimeout(() => { eventTickerEl.className = ''; }, 2600);
      }

