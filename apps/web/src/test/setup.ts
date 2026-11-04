import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { resetDbForTests } from '../lib/db';

beforeEach(() => {
  // A fresh database for every test.
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  window.location.hash = '';
});

afterEach(() => cleanup());
