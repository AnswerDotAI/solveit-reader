// Shared API module for Solveit interaction
const api = {
  // Strip trailing slash from instance URL
  cleanUrl(instance) { return instance.replace(/\/+$/, ''); },

  async post(url, body, cookies) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies
      },
      body: new URLSearchParams(body),
      credentials: 'include'
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  },

  async createDialog(instance, name, cookies) {
    return this.post(`${this.cleanUrl(instance)}/create_dialog_`, {name, api: 'true'}, cookies);
  },

  async dialogExists(instance, name, cookies) {
    try {
      const res = await this.post(`${this.cleanUrl(instance)}/curr_dialog_`, {dlg_name: name}, cookies);
      return res && !res.error;
    } catch { return false; }
  },

  async addMessage(instance, dlgName, content, msgType, cookies, placement='at_end') {
    return this.post(`${this.cleanUrl(instance)}/add_relative_`, {
      dlg_name: dlgName,
      content,
      msg_type: msgType,
      placement
    }, cookies);
  },

  async readMessage(instance, dlgName, msgId, cookies) {
    return this.post(`${this.cleanUrl(instance)}/read_msg_`, {
      dlg_name: dlgName,
      id_: msgId,
      n: 0,
      relative: 'true'
    }, cookies);
  },

  async execMessage(instance, dlgName, msgId, cookies, timeout=120000, interval=500) {
    // Add to run queue
    await this.post(`${this.cleanUrl(instance)}/add_runq_`, {
      dlg_name: dlgName,
      id_: msgId,
      api: 'true'
    }, cookies);
    
    // Poll until complete
    const start = Date.now();
    while (Date.now() - start < timeout) {
      await new Promise(r => setTimeout(r, interval));
      const msg = await this.readMessage(instance, dlgName, msgId, cookies);
      if (!msg.run) return msg;
    }
    throw new Error('Execution timeout');
  },

  async getMessages(instance, dlgName, cookies) {
    return this.post(`${this.cleanUrl(instance)}/find_msgs_`, {dlg_name: dlgName}, cookies);
  }
};
