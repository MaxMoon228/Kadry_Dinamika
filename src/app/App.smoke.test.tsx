// @vitest-environment jsdom
/**
 * Smoke-тест маршрутов: рендер всего приложения в jsdom для каждой роли,
 * ожидание асинхронных данных, проверка отсутствия ошибок и корректности guard-ов.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { getMockIndex } from "../data/mock/mockDataset";
import type { Role } from "../domain/user";
import App from "./App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = RO;
  window.scrollTo = () => {};
});

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
});

async function render(role: Role, hash: string): Promise<HTMLElement> {
  sessionStorage.setItem("kd-demo-role", role);
  window.location.hash = hash;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<App />));
  await settle();
  return host;
}

async function settle(timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120));
    });
    if (!host!.querySelector(".skeleton") && !host!.querySelector('[aria-busy="true"]')) return;
  }
}

function assertHealthy(el: HTMLElement) {
  const text = el.textContent ?? "";
  expect(text).not.toContain("Не удалось загрузить данные");
  expect(text).not.toContain("Интерфейс столкнулся с ошибкой");
}

const ROUTES = [
  "#/overview",
  "#/schools",
  "#/staff",
  "#/dynamics",
  "#/mobility",
  "#/forecast",
  "#/calculator",
  "#/analytics",
  "#/data",
  "#/monitoring",
];

describe("routes render for system roles", () => {
  for (const role of ["education_head", "analyst"] as const) {
    for (const route of ROUTES) {
      it(`${role} ${route}`, async () => {
        const el = await render(role, route);
        assertHealthy(el);
        const forbidden = el.textContent!.includes("Недостаточно прав");
        if (route === "#/monitoring" && role === "education_head") expect(forbidden).toBe(true);
        else expect(forbidden).toBe(false);
      });
    }
  }
});

describe("director scope in UI", () => {
  const [own, other] = getMockIndex().ds.schools;

  it("навигация показывает «Моя школа», фильтр округа скрыт", async () => {
    const el = await render("school_director", "#/overview");
    assertHealthy(el);
    const nav = [...el.querySelectorAll('nav[aria-label="Основная навигация"] button')].map(
      (b) => b.textContent,
    );
    expect(nav).toContain("Моя школа");
    expect(nav).not.toContain("Школы");
    expect(el.querySelector('[aria-label="Округ"]')).toBeNull();
    expect(el.textContent).toContain("Кадровая ситуация в школе");
  });

  it("#/schools перенаправляет на свою школу", async () => {
    const el = await render("school_director", "#/schools");
    await settle();
    expect(window.location.hash).toContain(`#/schools/${own.id}`);
    expect(el.textContent).toContain(own.name);
  });

  it("URL чужой школы → «Недостаточно прав для просмотра этой школы»", async () => {
    const el = await render("school_director", `#/schools/${other.id}`);
    expect(el.textContent).toContain("Недостаточно прав для просмотра этой школы");
    expect(el.textContent).not.toContain(other.name);
  });

  it("страницы данных и мониторинга закрыты", async () => {
    for (const r of ["#/data", "#/monitoring"]) {
      const el = await render("school_director", r);
      expect(el.textContent).toContain("Недостаточно прав");
      act(() => root?.unmount());
      host?.remove();
    }
  });

  it("калькулятор: школа заблокирована, прогноз и валидация работают", async () => {
    const el = await render("school_director", "#/calculator");
    assertHealthy(el);
    const locked = [...el.querySelectorAll("input[disabled]")].map(
      (i) => (i as HTMLInputElement).value,
    );
    expect(locked).toContain(own.name);
    const submit = [...el.querySelectorAll("button")].find(
      (b) => b.textContent === "Рассчитать прогноз",
    )!;
    await act(async () => submit.click());
    await settle();
    await settle();
    expect(el.textContent).toContain("mock-heuristic-0.1");
    expect(el.textContent).toContain("Факторы, повлиявшие на прогноз модели");
    expect(el.textContent).toContain("Уйдёт из системы образования");

    const age = [...el.querySelectorAll("label")]
      .find((l) => l.textContent?.startsWith("Возраст, лет"))!
      .querySelector("input")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(age, "10");
      age.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const submit2 = [...el.querySelectorAll("button")].find(
      (b) => b.textContent === "Рассчитать прогноз",
    )!;
    await act(async () => submit2.click());
    expect(el.textContent).toContain("Возраст — целое число от 18 до 80");
  });
});
