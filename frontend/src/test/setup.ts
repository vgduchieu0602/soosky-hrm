import "@testing-library/jest-dom/vitest";

/**
 * jsdom không có sẵn vài API mà luồng nhập CSV dùng tới. Bù đúng phần thiếu để
 * test chạy được mà không phải sửa mã sản phẩm cho hợp với môi trường test.
 */
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:mock";
  URL.revokeObjectURL = () => {};
}

if (typeof File !== "undefined" && typeof File.prototype.text !== "function") {
  // jsdom cũ chưa có File.prototype.text.
  File.prototype.text = function text(this: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
