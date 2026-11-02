const ORGANIZER_PASSWORD = "admin123"; // change this
const KEY = "event-ticketing-data";
const $ = id => document.getElementById(id);

// ---------- storage (kept in this browser only) ----------
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.events && d.bookings) return d;
  } catch (e) {}
  return { events: [], bookings: [], nextBooking: 1000, nextEvent: 1 };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
}
let db = load();
let selected = null;

// ---------- helpers ----------
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function say(id, text, ok) {
  const el = $(id);
  el.textContent = text;
  el.className = "msg " + (ok ? "ok" : "err");
}
function showTab(book) {
  $("bookView").hidden = !book;
  $("orgView").hidden = book;
  $("tabBook").classList.toggle("on", book);
  $("tabOrg").classList.toggle("on", !book);
}

// ---------- booker ----------
function renderEvents() {
  const box = $("eventList");
  if (!db.events.length) {
    box.innerHTML = '<p class="empty">No events yet. The organizer needs to add one first.</p>';
    return;
  }
  box.innerHTML = db.events.map(e => `
    <div class="ticket${e.id === selected ? " picked" : ""}">
      <div class="info"><h3>${esc(e.name)}</h3><p>${esc(e.date)}</p></div>
      <div class="stub-side">
        <b>Rs.${e.price}</b>
        <span>${e.seats ? e.seats + " seats left" : "Sold out"}</span>
        <button data-id="${e.id}" ${e.seats ? "" : "disabled"}>Select</button>
      </div>
    </div>`).join("");
}
function updateTotal() {
  const e = db.events.find(x => x.id === selected);
  const qty = parseInt($("qty").value, 10);
  $("total").textContent = "Rs." + (e && qty > 0 ? e.price * qty : 0);
}
function selectEvent(id) {
  selected = id;
  const e = db.events.find(x => x.id === id);
  $("selName").textContent = e.name + " (" + e.date + ")";
  $("bookPanel").hidden = false;
  $("bookMsg").textContent = "";
  renderEvents();
  updateTotal();
}
function book() {
  const e = db.events.find(x => x.id === selected);
  const name = $("uName").value.trim();
  const qty = parseInt($("qty").value, 10);
  if (!e) return say("bookMsg", "Select an event first.", false);
  if (!name) return say("bookMsg", "Enter your name.", false);
  if (!(qty >= 1)) return say("bookMsg", "Tickets must be at least 1.", false);
  if (qty > e.seats) return say("bookMsg", "Only " + e.seats + " seats left.", false);

  const total = e.price * qty;
  e.seats -= qty;
  db.nextBooking++;
  db.bookings.push({ id: db.nextBooking, name, eventId: e.id, event: e.name,
    date: e.date, qty, total, status: "Confirmed" });
  save();

  const r = $("receipt");
  r.hidden = false;
  r.innerHTML = `<h3>Booking confirmed</h3>
    <p>Booking ID: <b>${db.nextBooking}</b> (keep this to cancel later)</p>
    <p>Name: ${esc(name)}</p>
    <p>Event: ${esc(e.name)} on ${esc(e.date)}</p>
    <p>Calculation: Rs.${e.price} x ${qty} = <b>Rs.${total}</b></p>`;
  $("bookPanel").hidden = true;
  selected = null;
  $("uName").value = "";
  $("qty").value = 1;
  renderEvents();
  renderOrganizer();
}
function cancelBooking() {
  const id = parseInt($("cid").value, 10);
  const name = $("cname").value.trim().toLowerCase();
  const b = db.bookings.find(x => x.id === id);
  if (!b || b.name.toLowerCase() !== name)
    return say("cancelMsg", "No booking found with that ID and name.", false);
  if (b.status === "Cancelled")
    return say("cancelMsg", "This booking is already cancelled.", false);
  b.status = "Cancelled";
  const e = db.events.find(x => x.id === b.eventId);
  if (e) e.seats += b.qty;
  save();
  say("cancelMsg", "Booking " + id + " cancelled. " + b.qty + " seats returned.", true);
  renderEvents();
  renderOrganizer();
}

// ---------- organizer ----------
function renderOrganizer() {
  $("evTable").innerHTML =
    "<tr><th>Event</th><th>Date</th><th>Price</th><th>Seats left</th><th></th></tr>" +
    (db.events.map(e => `<tr><td>${esc(e.name)}</td><td>${esc(e.date)}</td>
      <td>Rs.${e.price}</td><td>${e.seats}</td>
      <td><button class="ghost" data-del="${e.id}">Delete</button></td></tr>`).join("")
      || '<tr><td colspan="5">No events added.</td></tr>');

  let revenue = 0;
  $("bkTable").innerHTML =
    "<tr><th>ID</th><th>Name</th><th>Event</th><th>Tickets</th><th>Total</th><th>Status</th></tr>" +
    (db.bookings.map(b => {
      if (b.status === "Confirmed") revenue += b.total;
      return `<tr><td>${b.id}</td><td>${esc(b.name)}</td><td>${esc(b.event)}</td>
        <td>${b.qty}</td><td>Rs.${b.total}</td><td>${b.status}</td></tr>`;
    }).join("") || '<tr><td colspan="6">No bookings yet.</td></tr>');
  $("rev").textContent = "Rs." + revenue;
}
function addEvent() {
  const name = $("eName").value.trim();
  const date = $("eDate").value;
  const price = parseInt($("ePrice").value, 10);
  const seats = parseInt($("eSeats").value, 10);
  if (!name || !date) return say("addMsg", "Event name and date are required.", false);
  if (!(price >= 0) || !(seats >= 1))
    return say("addMsg", "Price must be 0 or more and seats at least 1.", false);
  db.events.push({ id: db.nextEvent++, name, date, price, seats });
  save();
  ["eName", "eDate", "ePrice", "eSeats"].forEach(i => $(i).value = "");
  say("addMsg", "Event added.", true);
  renderEvents();
  renderOrganizer();
}

// ---------- wiring ----------
$("tabBook").onclick = () => showTab(true);
$("tabOrg").onclick = () => showTab(false);
$("eventList").onclick = ev => {
  const btn = ev.target.closest("button[data-id]");
  if (btn) selectEvent(parseInt(btn.dataset.id, 10));
};
$("qty").oninput = updateTotal;
$("bookBtn").onclick = book;
$("cancelBtn").onclick = cancelBooking;
$("loginBtn").onclick = () => {
  if ($("pw").value === ORGANIZER_PASSWORD) {
    $("login").hidden = true;
    $("dash").hidden = false;
    $("pw").value = "";
    $("loginMsg").textContent = "";
  } else {
    say("loginMsg", "Wrong password.", false);
  }
};
$("logoutBtn").onclick = () => { $("dash").hidden = true; $("login").hidden = false; };
$("addBtn").onclick = addEvent;
$("evTable").onclick = ev => {
  const btn = ev.target.closest("button[data-del]");
  if (!btn) return;
  db.events = db.events.filter(x => x.id !== parseInt(btn.dataset.del, 10));
  save();
  renderEvents();
  renderOrganizer();
};
$("eDate").min = new Date().toISOString().split("T")[0];

renderEvents();
renderOrganizer();
