const {test, expect} = require("playwright/test");
const {__internal} = require("./lib/mytv-helpers");

test("focusFirstRowStart moves focus to the requested cate row item", async ({page}) => {
    await page.setViewportSize({width: 1400, height: 1000});
    await page.setContent(`
    <style>
      body {
        margin: 0;
        background: #111;
        color: white;
        font-family: sans-serif;
      }
      .item {
        position: absolute;
        width: 140px;
        height: 120px;
        border: 2px solid transparent;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .focused {
        border-color: orange;
      }
    </style>
    <div id="row1-item1" class="item focused" data-row="1" data-col="1" style="left: 220px; top: 220px;">A1</div>
    <div id="row1-item2" class="item" data-row="1" data-col="2" style="left: 420px; top: 220px;">A2</div>
    <div id="row2-item1" class="item" data-row="2" data-col="1" style="left: 220px; top: 420px;">B1</div>
    <div id="row2-item2" class="item" data-row="2" data-col="2" style="left: 420px; top: 420px;">B2</div>
    <script>
      document.addEventListener("keydown", (event) => {
        const focused = document.querySelector(".focused");
        if (!focused) return;

        const row = Number(focused.dataset.row);
        const col = Number(focused.dataset.col);
        const moves = {
          ArrowRight: [row, col + 1],
          ArrowLeft: [row, col - 1],
          ArrowDown: [row + 1, col],
          ArrowUp: [row - 1, col],
        };
        const target = moves[event.key];
        if (!target) return;

        const next = document.querySelector(\`.item[data-row="\${target[0]}"][data-col="\${target[1]}"]\`);
        if (!next) return;

        focused.classList.remove("focused");
        next.classList.add("focused");
        event.preventDefault();
      });
    </script>
  `);

    await __internal.focusFirstRowStart(page, {
        id: "row2-item1",
        rect: {x: 220, y: 420, width: 140, height: 120},
    });

    await expect(page.locator("#row2-item1")).toHaveClass(/focused/);
});

test("chooseDirection moves up from wide spacebar to an overlapping letter key", () => {
    const direction = __internal.chooseDirection(
        {x: 1272, y: 505, width: 334, height: 68},
        {x: 1528, y: 416, width: 70, height: 70}
    );

    expect(direction).toBe("ArrowUp");
});

test("findServiceIdInAllServices finds a service after remote navigation", async ({page}) => {
    await page.setViewportSize({width: 1400, height: 1000});
    await page.setContent(`
    <style>
      body {
        margin: 0;
        background: #111;
        color: white;
        font-family: sans-serif;
      }
      .service {
        position: absolute;
        left: 240px;
        top: 220px;
        width: 180px;
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid transparent;
      }
      .hidden {
        display: none;
      }
      .focused {
        border-color: orange;
      }
    </style>
    <div id="dropdown_service_items_row0">
      <div id="service-sports" class="service" service_title="Thể thao"><span id="service-sports-label">Thể thao</span></div>
    </div>
    <div id="dropdown_service_items_row1">
      <div id="service-danet" class="service hidden" service_title="Danet"><span id="service-danet-label">Danet</span></div>
    </div>
    <script>
      let moveCount = 0;
      document.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowDown") return;
        moveCount += 1;
        if (moveCount < 2) return;

        const current = document.querySelector(".focused");
        if (current) current.classList.remove("focused");

        const target = document.querySelector("#service-danet");
        target.classList.remove("hidden");
        target.classList.add("focused");
      });
    </script>
  `);

    const serviceId = await __internal.findServiceIdInAllServices(page, '"Danet"');

    expect(serviceId).toBe("service-danet");
});

test("closeAdvertisePopupIfVisible clicks type-button 0 without focused class", async ({page}) => {
    await page.setContent(`
    <style>
      #advertise-popup {
        display: block;
      }
      .advertise-btn {
        width: 120px;
        height: 40px;
      }
    </style>
    <div id="advertise-popup">
      <div id="advertise-popup-container">
        <button class="advertise-btn" type-button="1">Xem thêm</button>
        <button class="advertise-btn" type-button="0">Đóng</button>
      </div>
    </div>
    <script>
      document.querySelector('[type-button="0"]').addEventListener("click", () => {
        document.querySelector("#advertise-popup").style.display = "none";
      });
    </script>
  `);

    const closed = await __internal.closeAdvertisePopupIfVisible(page);

    expect(closed).toBe(true);
    await expect(page.locator("#advertise-popup")).toBeHidden();
});

test("getVisiblePopup reads popup text from attributes", async ({page}) => {
    await page.setContent(`
    <style>
      #error-popup {
        display: block;
        width: 520px;
        min-height: 180px;
      }
      .popup-message,
      .popup-close {
        width: 180px;
        height: 44px;
      }
    </style>
    <div id="error-popup">
      <div class="popup-message" data-message="Không thể phát nội dung này"></div>
      <button class="popup-close" button-title="Đóng">Đóng</button>
    </div>
  `);

    const popup = await __internal.getVisiblePopup(page);

    expect(popup.text).toContain("Không thể phát nội dung này");
    expect(popup.closeText).toContain("Đóng");
});
