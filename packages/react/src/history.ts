export interface HistoryLocation {
  href: string;
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
}

export interface RouterHistory {
  readonly location: HistoryLocation;
  listen(listener: () => void): () => void;
  push(href: string, state?: unknown): void;
  replace(href: string, state?: unknown): void;
}

function readBrowserLocation(): HistoryLocation {
  return {
    href: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    state: window.history.state,
  };
}

export function createBrowserHistory(): RouterHistory {
  return {
    get location() {
      return readBrowserLocation();
    },
    listen(listener) {
      window.addEventListener('popstate', listener);
      return () => window.removeEventListener('popstate', listener);
    },
    push(href, state) {
      window.history.pushState(state, '', href);
    },
    replace(href, state) {
      window.history.replaceState(state, '', href);
    },
  };
}

function readHashLocation(): HistoryLocation {
  const rawHash = window.location.hash.replace(/^#/, '') || '/';
  const url = new URL(rawHash.startsWith('/') ? `http://hash.local${rawHash}` : `http://hash.local/${rawHash}`);

  return {
    href: `${url.pathname}${url.search}${url.hash}`,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    state: window.history.state,
  };
}

export function createHashHistory(): RouterHistory {
  return {
    get location() {
      return readHashLocation();
    },
    listen(listener) {
      window.addEventListener('popstate', listener);
      window.addEventListener('hashchange', listener);
      return () => {
        window.removeEventListener('popstate', listener);
        window.removeEventListener('hashchange', listener);
      };
    },
    push(href, state) {
      window.history.pushState(state, '', `#${href.startsWith('/') ? href : `/${href}`}`);
    },
    replace(href, state) {
      window.history.replaceState(state, '', `#${href.startsWith('/') ? href : `/${href}`}`);
    },
  };
}

export interface MemoryHistoryOptions {
  initialEntries?: string[];
}

class MemoryHistory implements RouterHistory {
  private readonly entries: Array<{ href: string; state: unknown }>;
  private index = 0;
  private readonly listeners = new Set<() => void>();

  constructor(options?: MemoryHistoryOptions) {
    const initialEntries = options?.initialEntries?.length ? options.initialEntries : ['/'];
    this.entries = initialEntries.map(entry => ({ href: entry, state: null }));
    this.index = this.entries.length - 1;
  }

  public get location(): HistoryLocation {
    const current = this.entries[this.index] ?? { href: '/', state: null };
    const url = new URL(current.href, 'http://memory.local');

    return {
      href: `${url.pathname}${url.search}${url.hash}`,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      state: current.state,
    };
  }

  public listen(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public push(href: string, state?: unknown): void {
    this.entries.splice(this.index + 1);
    this.entries.push({ href, state });
    this.index = this.entries.length - 1;
    this.emit();
  }

  public replace(href: string, state?: unknown): void {
    this.entries[this.index] = { href, state };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export function createMemoryHistory(options?: MemoryHistoryOptions): RouterHistory {
  return new MemoryHistory(options);
}
