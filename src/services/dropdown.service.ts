// src/services/dropdown.service.ts
import type Redis from "ioredis";
import { FilterQuery, UpdateQuery } from "mongoose";
import { Dropdown, IDropdown, IDropdownValue } from "../models/dropdown.model";
import {
  bumpCollectionVersion,
  CacheKeys,
  del,
  getCollectionVersion,
  getJSON,
  hashKey,
  setJSON,
  stableStringify
} from "../utils/cache";

type DropdownLean = Pick<IDropdown, "name"> & { _id: string };

/** ---------------- Service API ---------------- */
export type DropdownListFilter = {
  name?: string;
};

type CacheDeps = {
  redis?: Redis;
  listTtlSec?: number;
  idTtlSec?: number;
  nameTtlSec?: number;
};

const DEFAULT_LIST_TTL = 60;
const DEFAULT_ID_TTL = 300;
const DEFAULT_NAME_TTL = 300;

export async function listDropdowns(
  filter: DropdownListFilter,
  page = 1,
  limit = 50,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;

  const q: FilterQuery<IDropdown> = {};
  if (filter.name) q.name = filter.name;

  const ver = await getCollectionVersion(redis);
  const payload = { ...filter, page, limit };
  const listKey = CacheKeys.list(ver, hashKey(stableStringify(payload)));

  const cached = await getJSON<unknown>(redis, listKey);
  console.log({cached})
  if (cached) return cached;

  const cursor = Dropdown.find(q).lean().sort({ name: 1, created_at: -1 });
  const total = await Dropdown.countDocuments(q);
  const items = await cursor.skip((page - 1) * limit).limit(limit);
  console.log({items})

  const result = {
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    data: items,
  };

  await setJSON(redis, listKey, result, listTtlSec);
  return result;
}

export async function getDropdownById(id: string, deps: CacheDeps = {}) {
  const { redis, idTtlSec = DEFAULT_ID_TTL } = deps;
  const idKey = CacheKeys.byId(id);

  const cached = await getJSON<IDropdown>(redis, idKey);
  if (cached) return cached;

  const doc = await Dropdown.findById(id).lean();
  if (!doc) return null;

  await setJSON(redis, idKey, doc, idTtlSec);
  return doc;
}

export async function getDropdownByName(name: string, deps: CacheDeps = {}) {
  const { redis, nameTtlSec = DEFAULT_NAME_TTL } = deps;
  const key = CacheKeys.byName(name);

  const cached = await getJSON<IDropdown>(redis, key);
  if (cached) return cached;

  const doc = await Dropdown.findOne({ name }).lean();
  if (!doc) return null;

  await setJSON(redis, key, doc, nameTtlSec);
  return doc;
}

export async function createDropdown(
  payload: { name: string; values?: { name: string; value: string }[] },
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const created = await Dropdown.create({
    name: payload.name,
    values: payload.values ?? [],
  });
  await bumpCollectionVersion(redis);
  return created.toObject();
}

export async function updateDropdown(
  id: string,
  update: UpdateQuery<IDropdown>,
  deps: CacheDeps = {}
) {
  const { redis } = deps;

  const before = await Dropdown.findById(id).lean<DropdownLean | null>();
  const doc = await Dropdown.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  }).lean<DropdownLean | null>();

  if (doc) {
    await del(redis, CacheKeys.byId(id));
    if (before?.name) await del(redis, CacheKeys.byName(before.name));
    if (doc.name) await del(redis, CacheKeys.byName(doc.name));
    await bumpCollectionVersion(redis);
  }
  return doc;
}

export async function addDropdownValue(
  id: string,
  value: { name: string; value: string },
  deps: CacheDeps = {}
) {
  const { redis } = deps;

  const doc = await Dropdown.findById(id);
  if (!doc) return null;

  const exists = doc.values.some(
    (v: IDropdownValue) => v.value === value.value
  );
  if (exists) {
    const err: any = new Error("Duplicate value inside dropdown values.");
    err.statusCode = 409;
    throw err;
  }

  doc.values.push(value);
  await doc.save();

  await del(redis, CacheKeys.byId(id));
  await del(redis, CacheKeys.byName(doc.name));
  await bumpCollectionVersion(redis);

  return doc.toObject();
}

export async function updateDropdownValue(
  id: string,
  oldValue: string,
  patch: { new_name?: string; new_value?: string },
  deps: CacheDeps = {}
) {
  const { redis } = deps;

  const doc = await Dropdown.findById(id);
  if (!doc) return null;

  const idx = doc.values.findIndex((v: IDropdownValue) => v.value === oldValue);
  if (idx === -1) return null;

  if (patch.new_value && patch.new_value !== oldValue) {
    const dup = doc.values.some(
      (v: IDropdownValue) => v.value === patch.new_value
    );
    if (dup) {
      const err: any = new Error("Duplicate value inside dropdown values.");
      err.statusCode = 409;
      throw err;
    }
    doc.values[idx].value = patch.new_value;
  }
  if (typeof patch.new_name === "string") {
    doc.values[idx].name = patch.new_name;
  }

  await doc.save();

  await del(redis, CacheKeys.byId(id));
  await del(redis, CacheKeys.byName(doc.name));
  await bumpCollectionVersion(redis);

  return doc.toObject();
}

export async function removeDropdownValue(
  id: string,
  valueToRemove: string,
  deps: CacheDeps = {}
) {
  const { redis } = deps;

  const updated = await Dropdown.findOneAndUpdate(
    { _id: id, "values.value": valueToRemove },
    { $pull: { values: { value: valueToRemove } } },
    { new: true }
  ).lean<DropdownLean | null>();

  if (updated) {
    await del(redis, CacheKeys.byId(id));
    await del(redis, CacheKeys.byName(updated.name));
    await bumpCollectionVersion(redis);
  }
  return updated;
}

export async function deleteDropdown(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;

  const doc = await Dropdown.findByIdAndDelete(id).lean<DropdownLean | null>();

  if (doc) {
    await del(redis, CacheKeys.byId(id));
    await del(redis, CacheKeys.byName(doc.name));
    await bumpCollectionVersion(redis);
  }
  return !!doc;
}
