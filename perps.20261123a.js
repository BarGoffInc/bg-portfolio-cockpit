(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const clsMoney = d => {
    const t = String(d||'');
    if (t.startsWith('+') && t !== '+$0.00') return 'pos';
    if (t.startsWith('-') && t !== '-$0.00' && t !== '$0.00') return 'neg';
    return '';
  };
  const tagClass = t => t==='CONFLICT'?'conflict':t==='STACKED'?'stacked':t==='ALIGNED'?'aligned':'';

  function ideaItem(it){
    const tag = it.book && it.book.tag;
    const tagHtml = tag ? `<span class="pxtag ${tagClass(tag)}">${esc(tag)}</span>` : '';
    const combined = it.book && it.book.combined_note && tag==='STACKED'
      ? ` ${esc(it.book.combined_note)}.` : '';
    const plan = it.book && it.book.plan_line ? esc(it.book.plan_line) : '';
    const reason = it.book && it.book.tag_reason && tag==='CONFLICT'
      ? ` ${esc(it.book.tag_reason)}` : '';
    const trigger = it.waiting_label && it.trigger
      ? `<div class="pxtrig">${esc(it.waiting_label)}: ${esc(it.trigger)}</div>`
      : (it.trigger && it.bucket==='waiting' ? `<div class="pxtrig">Not placeable until trigger: ${esc(it.trigger)}</div>` : '');
    return `<li>
      <p class="pxline">${esc(it.line)}</p>
      <p class="pxmeta">${tagHtml}${plan}${reason}${combined}</p>
      ${trigger}
    </li>`;
  }

  function ctaBlock(title, items, empty){
    const body = (items&&items.length)
      ? `<ul class="pxlist">${items.map(ideaItem).join('')}</ul>`
      : `<p class="pxempty">${esc(empty)}</p>`;
    return `<section class="pxcta"><h2>${esc(title)}</h2>${body}</section>`;
  }

  function kv(label, value, kind){
    const k = kind || clsMoney(value);
    return `<div><small>${esc(label)}</small><b class="${k}">${esc(value??'—')}</b></div>`;
  }

  function tradeRows(trades, paper){
    if (!trades || !trades.length) return '<p class="pxnote">No closed trades in this log.</p>';
    const head = paper
      ? `<tr><th>Sent</th><th>Name</th><th>Side</th><th class="r">Entry</th><th class="r">P&amp;L</th><th class="r">R</th><th>Status</th></tr>`
      : `<tr><th>Closed</th><th>Name</th><th>Side</th><th class="r">Size</th><th class="r">Entry</th><th class="r">Exit</th><th class="r">Net P&amp;L</th><th class="r">Fees</th><th class="r">Funding</th><th>Result</th></tr>`;
    const rows = trades.map(t => {
      if (paper){
        const pnl = t.total_usd==null?'—':(t.total_usd>=0?`+$${Number(t.total_usd).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:`-$${Math.abs(t.total_usd).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`);
        const R = t.total_R==null?'—':Number(t.total_R).toFixed(2);
        return `<tr><td>${esc(t.sent_at_et||'')}</td><td>${esc(t.asset||'')}</td><td>${esc(t.direction||'')}</td><td class="r">${t.avg_entry==null?'—':esc(String(t.avg_entry))}</td><td class="r ${clsMoney(pnl)}">${pnl}</td><td class="r">${R}</td><td>${esc(t.status||'')}</td></tr>`;
      }
      const net = t.net_pnl_usd==null?'—':(t.net_pnl_usd>=0?`+$${Number(t.net_pnl_usd).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:`-$${Math.abs(t.net_pnl_usd).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`);
      const fees = t.fees_usd==null?'—':`$${Number(t.fees_usd).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
      const fund = t.funding_usd==null?'—':(t.funding_usd>=0?`+$${Number(t.funding_usd).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:`-$${Math.abs(t.funding_usd).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`);
      const entry = t.entry==null?'—':Number(t.entry).toLocaleString(undefined,{maximumFractionDigits:6});
      const exit = t.exit==null?'—':Number(t.exit).toLocaleString(undefined,{maximumFractionDigits:6});
      const size = t.size==null?'—':Number(t.size).toLocaleString(undefined,{maximumFractionDigits:6});
      return `<tr><td>${esc(t.closed_at_et||t.date||'')}</td><td>${esc(t.asset||'')}</td><td>${esc(t.side||'')}</td><td class="r">${size}</td><td class="r">${entry}</td><td class="r">${exit}</td><td class="r ${clsMoney(net)}">${net}</td><td class="r">${fees}</td><td class="r ${clsMoney(fund)}">${fund}</td><td>${esc(t.result||t.status||'')}</td></tr>`;
    }).join('');
    return `<div style="overflow-x:auto"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
  }

  function paint(d){
    const asof = $('[data-asof]');
    if (asof) asof.textContent = d.generated_at_et ? ('Feed as of ' + d.generated_at_et) : (d.exported_at_et || '');
    if (d.error){
      $('#root').innerHTML = `<p>Could not load the Perp Desk feed. ${esc(d.error)}</p>`;
      return;
    }
    const acct = d.account||{};
    const week = d.week||{};
    const paper = d.paper||{};
    const actual = d.actual||{};
    const cmp = d.comparison||{};
    const cta = d.cta||{};
    const prereqBits = [];
    if (acct.flat) prereqBits.push('The perps account is flat.');
    if (acct.place_now) prereqBits.push(esc(acct.place_now) + (acct.place_now.endsWith('.')?'':'.'));
    else if (acct.note) prereqBits.push(esc(acct.note));
    if (actual.week_vs_target) prereqBits.push('Actual week P&amp;L: ' + esc(actual.week_vs_target) + '.');
    const lede = `Feed generated ${esc(d.generated_at_et||'—')}. Paper updated ${esc(paper.updated_at_et_pretty||paper.updated_at_et||'—')}. Actual updated ${esc(actual.updated_at_et_pretty||actual.updated_at_et||'—')}. ${esc(d.refresh_note||'')}`;

    const paperClosed = (paper.closed_trades||[]);
    const actualTrades = (actual.trades||[]);

    const html = `<div class="pxpage">
      <p class="lede">${lede}</p>
      ${prereqBits.length?`<p class="prereq">${prereqBits.join(' ')}</p>`:''}
      ${ctaBlock('Place now', cta.place_now, 'Nothing to place right now.')}
      ${ctaBlock('Waiting on trigger', cta.waiting, 'No ideas waiting on a trigger.')}
      ${ctaBlock('Stand down', cta.stand_down, 'Nothing to stand down from.')}

      <div class="pxbooks">
        <section class="pxbook actual">
          <div class="kicker">Actual · Hyperliquid fills</div>
          <h2>Live book</h2>
          <p class="when">${esc(actual.updated_at_et_pretty||actual.updated_at_et||'')} · ${esc(actual.history_span_note||'From real fills, never typed in.')}</p>
          <div class="pxkv">
            ${kv('Week vs $10k', actual.week_vs_target || actual.week_pnl_display)}
            ${kv('All-time P&L', actual.total_display)}
            ${kv('Realized P&L', actual.realized_display)}
            ${kv('Win rate', actual.hit_rate_display)}
            ${kv('Funding (net)', actual.funding_display)}
            ${kv('Fees', actual.fees_display)}
          </div>
          <p class="pxnote">${esc(actual.honest_note||'')}</p>
          <h3 style="margin:12px 0 0;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)">Closed trades</h3>
          ${tradeRows(actualTrades, false)}
        </section>
        <section class="pxbook paper">
          <div class="kicker">Paper · provisional</div>
          <h2>Simulated book</h2>
          <p class="when">${esc(paper.updated_at_et_pretty||paper.updated_at_et||'')} · Not real P&amp;L. Replay can flip fills.</p>
          <div class="pxkv">
            ${kv('Week P&L (provisional)', paper.week_pnl_display)}
            ${kv('Week vs $10k', paper.week_progress_display)}
            ${kv('All-time P&L', paper.total_display)}
            ${kv('Win rate', paper.hit_rate_display)}
            ${kv('Avg R (closed)', paper.avg_R_closed==null?'—':Number(paper.avg_R_closed).toFixed(2))}
            ${kv('Max drawdown', paper.max_drawdown_display)}
          </div>
          <p class="pxnote">${esc(paper.honest_note||paper.week_pnl_note||'')}</p>
          <h3 style="margin:12px 0 0;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)">Closed paper trades</h3>
          ${tradeRows(paperClosed, true)}
        </section>
      </div>

      <section class="pxcmp">
        <h2>Recommendation vs actual</h2>
        <p style="margin:0">${esc(cmp.note||'Paper and actual are different books; the gap is not a score.')}
          Recommendations sent ${esc(cmp.recommendations_sent??'—')}, taken ${esc(cmp.recommendations_taken??'—')}, not taken ${esc(cmp.recommendations_not_taken??'—')}.
          Actual trades ${esc(cmp.actual_trades??'—')}, matched ${esc(cmp.actual_matched??'—')}, unmatched ${esc(cmp.actual_unmatched??'—')}.
          Updated ${esc(cmp.updated_at_et_pretty||cmp.updated_at_et||'—')}.</p>
      </section>
      ${(d.gaps&&d.gaps.length)?`<ul class="pxgaps">${d.gaps.map(g=>`<li>${esc(g)}</li>`).join('')}</ul>`:''}
    </div>`;
    $('#root').className = 'card wide';
    $('#root').innerHTML = html;
  }

  function load(){
    const url = 'perps.json?t=' + Date.now();
    return fetch(url, {cache:'no-store'}).then(r=>{
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    }).then(paint).catch(e=>{
      const asof=$('[data-asof]'); if(asof) asof.textContent='Could not load';
      $('#root').innerHTML = `<p>Could not load perps.json. ${esc(e.message||e)}</p>`;
    });
  }

  document.addEventListener('click', e=>{
    const btn=e.target.closest('[data-refresh]'); if(!btn) return;
    e.preventDefault(); load();
  });
  document.addEventListener('submit', e=>{
    const f=e.target.closest('form.tks'); if(!f) return;
    e.preventDefault();
    const v=(f.q.value||'').trim().split(/\s/)[0];
    if(v) location.href='ticker.html?tk='+encodeURIComponent(v.toUpperCase());
  });
  load();
})();
