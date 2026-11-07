import test from "node:test";
import assert from "node:assert/strict";
import { listFeaturedBusPhotos } from "../src/services/busPhotoService.js";

test("busPhotoService returns an array of featured photos (or empty array)", async () => {
  const photos = await listFeaturedBusPhotos();
  assert.ok(Array.isArray(photos), "Expected listFeaturedBusPhotos to return an array");
});

test("cloudinaryService rejects invalid config or missing files gracefully", async () => {
  const { uploadImageBuffer } = await import("../src/services/cloudinaryService.js");
  // Calling uploadImageBuffer without a buffer should reject with a clear error
  await assert.rejects(
    async () => {
      await uploadImageBuffer(null);
    },
    (err) => {
      assert.ok(err);
      return true;
    }
  );
});

