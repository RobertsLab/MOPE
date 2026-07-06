import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';
import { StoreProvider } from '../src/state/store';

function renderApp() {
  return render(<StoreProvider><App /></StoreProvider>);
}

describe('App UI', () => {
  it('mounts and shows the landing hero + demo button', () => {
    renderApp();
    expect(screen.getAllByText(/Marine Pathway Mapper/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Load demo data/i })).toBeTruthy();
  });

  it('loads demo data and renders the mapping-quality summary end-to-end', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Load demo data/i }));
    expect(screen.getByText(/Mapping quality summary/i)).toBeTruthy();
    // Stat grid present.
    expect(screen.getAllByText(/Uploaded features/i).length).toBeGreaterThan(0);
    // Audit table rendered with mapped rows (at least one "yes" pill).
    expect(screen.getAllByText(/^yes$/i).length).toBeGreaterThan(0);
  });

  it('navigates to Pathways and Visualize and renders an SVG diagram', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Load demo data/i }));
    fireEvent.click(screen.getByRole('button', { name: /4\. Pathways/i }));
    expect(screen.getByText(/Discover & rank pathways/i)).toBeTruthy();
    // At least one pathway card with a Visualize button.
    const vizButtons = screen.getAllByRole('button', { name: /Visualize/i });
    expect(vizButtons.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /5\. Visualize/i }));
    const svg = document.querySelector('svg[role="img"]');
    expect(svg).toBeTruthy();
    // Diagram contains node rects/text.
    expect(svg!.querySelectorAll('g[role="button"]').length).toBeGreaterThan(0);
  });
});
