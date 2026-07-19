/* judul & kutipan pembakar semangat, dipilih acak tiap kali layar muat tampil */
const TITLE = { en: 'PREPARING FOR BATTLE', id: 'BERSIAP UNTUK PERTEMPURAN' };
const QUOTES = [
  { en: 'The supreme art of war is to subdue the enemy without fighting.', id: 'Seni perang tertinggi adalah menaklukkan musuh tanpa harus bertempur.', by: 'Sun Tzu' },
  { en: 'Victorious warriors win first and then go to war, while defeated warriors go to war first and then seek to win.', id: 'Prajurit yang menang, menang dahulu baru berperang; yang kalah, berperang dahulu baru mencari kemenangan.', by: 'Sun Tzu' },
  { en: 'Know yourself and know your enemy, and you will never be defeated in a hundred battles.', id: 'Kenali dirimu dan kenali musuhmu, maka kau takkan pernah kalah dalam seratus pertempuran.', by: 'Sun Tzu' },
  { en: 'In the midst of chaos, there is also opportunity.', id: 'Di tengah kekacauan, di situ pula ada peluang.', by: 'Sun Tzu' },
  { en: 'A good plan violently executed now is better than a perfect plan next week.', id: 'Rencana baik yang dijalankan dengan tegas sekarang lebih baik daripada rencana sempurna minggu depan.', by: 'George S. Patton' },
  { en: 'Courage is fear holding on a minute longer.', id: 'Keberanian adalah rasa takut yang bertahan semenit lebih lama.', by: 'George S. Patton' },
  { en: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', id: 'Sukses bukan akhir, kegagalan bukan kiamat: keberanianlah untuk terus melangkah yang menentukan.', by: 'Winston Churchill' },
  { en: 'Victory belongs to the most persevering.', id: 'Kemenangan adalah milik mereka yang paling gigih bertahan.', by: 'Napoleon Bonaparte' },
];

export function initBootScreen() {
  let lang = 'en';
  try { const saved = localStorage.getItem('bf-lang'); if (saved === 'en' || saved === 'id') lang = saved; } catch (e) { }
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const titleEl = document.getElementById('boot-title');
  const qEl = document.getElementById('boot-quote'), byEl = document.getElementById('boot-quote-by');
  if (titleEl) titleEl.textContent = TITLE[lang];
  if (qEl) qEl.textContent = '“' + q[lang] + '”';
  if (byEl) byEl.textContent = '— ' + q.by;
}
