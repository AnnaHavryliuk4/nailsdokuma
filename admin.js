import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const config = window.NAILSDOKUMA_SUPABASE_CONFIG || {};
const ready = Boolean(config.url && config.publishableKey);
const supabase = ready ? createClient(config.url, config.publishableKey) : null;
const loginPanel = document.getElementById('login-panel');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const dashboard = document.getElementById('dashboard');
const dashboardMessage = document.getElementById('dashboard-message');
const reviewList = document.getElementById('admin-review-list');
const signOutButton = document.getElementById('sign-out');
let currentStatus = 'pending';
let language = 'tr';
const words = {
  tr: { noConfig:'Supabase henüz yapılandırılmadı. SETUP_SUPABASE.md dosyasını izleyin.', login:'E-posta veya şifre hatalı ya da bu hesap kullanılamıyor.', notAdmin:'Bu hesap yönetici olarak yetkilendirilmemiş.', loadError:'Yorumlar alınamadı. RLS politikalarını ve bağlantı bilgilerini kontrol edin.', empty:'Bu durumda yorum bulunmuyor.', status:{pending:'Bekleyen', approved:'Onaylanan', rejected:'Reddedilen'}, date:'tr-TR', approve:'Onayla', reject:'Reddet', remove:'Sil', deleting:'Silinsin mi? Bu işlem geri alınamaz.', actionError:'İşlem tamamlanamadı.', signout:'Oturum kapatılamadı.', language:'Dili değiştir', setupError:'Yönetici listesi okunamadı. SQL migration ve Supabase bağlantı ayarlarını kontrol edin.' },
  ua: { noConfig:'Supabase ще не налаштовано. Дотримуйтеся SETUP_SUPABASE.md.', login:'Неправильна пошта або пароль, або обліковий запис недоступний.', notAdmin:'Цей обліковий запис не має прав адміністратора.', loadError:'Не вдалося завантажити відгуки. Перевірте налаштування та політики RLS.', empty:'Відгуків із таким статусом немає.', status:{pending:'Очікують', approved:'Схвалені', rejected:'Відхилені'}, date:'uk-UA', approve:'Схвалити', reject:'Відхилити', remove:'Видалити', deleting:'Видалити відгук? Цю дію не можна скасувати.', actionError:'Не вдалося виконати дію.', signout:'Не вдалося завершити сеанс.', language:'Змінити мову', setupError:'Не вдалося перевірити список адміністраторів. Перевірте міграцію SQL і налаштування Supabase.' }
};
const t = () => words[language];
function setLanguage(next) {
  language = next;
  document.documentElement.lang = language === 'ua' ? 'uk' : 'tr';
  document.querySelectorAll('[data-tr][data-ua]').forEach(el => {
    const value = el.dataset[language];
    if (value !== undefined) el.innerHTML = value;
  });
  document.getElementById('language').innerHTML = language === 'tr' ? '<b>TR</b> / UA' : 'TR / <b>UA</b>';
  document.getElementById('language').setAttribute('aria-label', t().language);
  if (!dashboard.hidden) loadReviews();
}
document.getElementById('language').addEventListener('click', () => setLanguage(language === 'tr' ? 'ua' : 'tr'));

async function getAdminMembership(user) {
  const { data, error } = await supabase.from('review_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  return { authorized: !error && Boolean(data), error };
}
function makeButton(label, action, danger = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = danger ? 'button secondary' : 'button';
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}
function renderReview(review) {
  const card = document.createElement('article');
  card.className = 'review';
  const content = document.createElement('div');
  const heading = document.createElement('h2');
  heading.textContent = review.customer_name;
  const badge = document.createElement('span');
  badge.className = 'status';
  badge.textContent = t().status[review.status] || review.status;
  heading.append(badge);
  const metadata = document.createElement('div');
  metadata.className = 'review-meta';
  metadata.textContent = `${new Date(review.created_at).toLocaleDateString(t().date, {year:'numeric',month:'short',day:'numeric'})} · ${review.language.toUpperCase()}`;
  const stars = document.createElement('div');
  stars.className = 'stars';
  stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const text = document.createElement('p');
  text.textContent = review.review_text;
  content.append(heading, metadata, stars, text);
  const actions = document.createElement('div');
  actions.className = 'actions';
  if (review.status === 'pending') {
    actions.append(makeButton(t().approve, () => updateStatus(review.id, 'approved')));
    actions.append(makeButton(t().reject, () => updateStatus(review.id, 'rejected'), true));
  }
  actions.append(makeButton(t().remove, () => deleteReview(review.id), true));
  card.append(content, actions);
  return card;
}
async function loadReviews() {
  reviewList.replaceChildren();
  dashboardMessage.textContent = '';
  const { data, error } = await supabase.from('reviews').select('id, customer_name, rating, review_text, language, status, created_at').eq('status', currentStatus).order('created_at', {ascending:false});
  if (error) {
    dashboardMessage.textContent = t().loadError;
    return;
  }
  if (!data?.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = t().empty;
    reviewList.append(empty);
    return;
  }
  data.forEach(review => reviewList.append(renderReview(review)));
}
async function updateStatus(id, status) {
  dashboardMessage.textContent = '';
  const { error } = await supabase.from('reviews').update({status}).eq('id', id);
  if (error) dashboardMessage.textContent = t().actionError;
  else await loadReviews();
}
async function deleteReview(id) {
  if (!window.confirm(t().deleting)) return;
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) dashboardMessage.textContent = t().actionError;
  else await loadReviews();
}

document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => {
  currentStatus = button.dataset.status;
  document.querySelectorAll('.tab').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
  loadReviews();
}));
signOutButton.addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) dashboardMessage.textContent = t().signout;
  else showLoggedOut();
});
function showLoggedOut() {
  dashboard.hidden = true;
  signOutButton.hidden = true;
  loginPanel.hidden = false;
}
async function showForUser(user) {
  loginPanel.hidden = true;
  loginMessage.textContent = '';
  const membership = await getAdminMembership(user);
  if (!membership.authorized) {
    await supabase.auth.signOut();
    loginPanel.hidden = false;
    loginMessage.textContent = membership.error ? t().setupError : t().notAdmin;
    return;
  }
  dashboard.hidden = false;
  signOutButton.hidden = false;
  await loadReviews();
}
loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginMessage.textContent = '';
  if (!ready) {
    loginMessage.textContent = t().noConfig;
    return;
  }
  const button = document.getElementById('login-button');
  button.disabled = true;
  const fields = new FormData(loginForm);
  const { data, error } = await supabase.auth.signInWithPassword({email: fields.get('email'), password: fields.get('password')});
  button.disabled = false;
  if (error || !data.user) {
    loginMessage.textContent = t().login;
    return;
  }
  await showForUser(data.user);
});
if (!ready) loginMessage.textContent = t().noConfig;
else {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) setTimeout(() => showForUser(session.user), 0);
    else showLoggedOut();
  });
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await showForUser(session.user);
}
