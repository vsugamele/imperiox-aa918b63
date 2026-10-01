import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildOfferJourneys } from "@shared/project-map";
import { OfferJourneys } from "@/components/mapa/OfferJourneys";

afterEach(cleanup);
describe("offer journey readout", () => {
  it("shows the observed gap, next action and source per offer, preserving pause and applicability", () => {
    const reading = buildOfferJourneys({ produtos: [{ nome: "Piloto", links: ["https://page.test/a"] }, { nome: "Pausada", ativo: false }] });
    render(<OfferJourneys reading={reading} />);
    const review = screen.getByLabelText("Piloto: Pendências de revisão");
    expect(review).toHaveTextContent("Revisão proposta");
    expect(review).toHaveTextContent("não comprova inexistência");
    const thanks = within(review).getByLabelText("Revisão de Página de obrigado");
    expect(thanks).toHaveTextContent("Confirmar se");
    expect(thanks).toHaveTextContent(reading.offers[0].source);
    expect(review).toHaveTextContent("9 etapas a conferir");
    expect(screen.queryByText(/etapas sem ativo vinculado/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Pausada: Pendências de revisão")).toHaveTextContent("não retoma a operação");
  });
  it("groups all stages per offer and makes guidance distinct from registered configuration", () => {
    const reading = buildOfferJourneys({ produtos: [{ nome: "Curso", preco: "47,00" }, { nome: "Serviço", ativo: false }] });
    render(<OfferJourneys reading={reading} />);
    for (const name of ["Curso", "Serviço"]) {
      const conversion = screen.getByLabelText(`${name}: Venda e pagamento`);
      const delivery = screen.getByLabelText(`${name}: Pós-compra e entrega`);
      const relationship = screen.getByLabelText(`${name}: Relacionamento e ascensão`);
      expect(within(conversion).getAllByRole("listitem", { hidden: true })).toHaveLength(3);
      expect(within(delivery).getAllByRole("listitem", { hidden: true })).toHaveLength(4);
      expect(within(relationship).getAllByRole("listitem", { hidden: true })).toHaveLength(2);
      expect(delivery).toHaveTextContent("podem ocorrer em paralelo");
      const members = screen.getByLabelText(`${name}: Área de membros`);
      expect(members).toHaveTextContent("Contrato proposto · a conferir");
      expect(members).toHaveTextContent("Não é contrato cadastrado");
      expect(members).toHaveTextContent("Não vinculado nesta leitura");
      expect(members).toHaveTextContent("outra forma de entrega");
    }
    expect(screen.getByText(/Preço não informado/)).toHaveTextContent("Pausada no cadastro");
  });
  it("preserves older readings without guidance and all nine verification stages", () => {
    const reading = buildOfferJourneys({ produtos: [{ nome: "Legado" }] });
    for (const item of reading.offers[0].steps) delete item.guidance;
    delete reading.offers[0].reviewTasks;
    render(<OfferJourneys reading={reading} />);
    const group = screen.getByLabelText("Legado: Etapas de conferência");
    expect(within(group).getAllByRole("listitem", { hidden: true })).toHaveLength(9);
    expect(within(group).queryByText("Contrato proposto · a conferir")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Legado: Pendências de revisão")).toHaveTextContent("9 etapas a conferir");
    expect(screen.getByLabelText("Legado: Página de obrigado")).toHaveTextContent("Não localizado neste cadastro");
  });
  it("shows every offer and its own pending thanks, email and delivery without crossing prints", () => {
    const reading = buildOfferJourneys({ produtos: [{ nome: "Oferta A", preco: "47,00", links: ["https://page.test/a"] }, { nome: "Oferta B", links: ["https://page.test/b"] }] }, [{ url: "https://page.test/a", image_url: "https://assets.test/registered.jpg" }]);
    render(<OfferJourneys reading={reading} />);
    expect(screen.getByText("Oferta A")).toBeInTheDocument();
    expect(screen.getByText("Oferta B")).toBeInTheDocument();
    const a = screen.getByLabelText("Oferta A: Páginas da oferta");
    expect(within(a).getByRole("img", { hidden: true })).toHaveAttribute("src", "https://assets.test/registered.jpg");
    expect(within(screen.getByLabelText("Oferta B: Páginas da oferta")).queryByRole("img", { hidden: true })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Oferta A: Página de obrigado")).toHaveTextContent("Não localizado neste cadastro");
    expect(screen.getByLabelText("Oferta A: E-mail de compra / acesso")).toHaveTextContent("Configuração: não conferida");
    const summary = screen.getByText("Oferta A").closest("summary")!;
    fireEvent.click(summary);
    // jsdom não implementa a alternância nativa de details; conferir o botão real dentro da etapa.
    fireEvent.click(within(a).getByRole("button", { hidden: true }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("shows failed image as unavailable and registered shared members as unbound", () => {
    const reading = buildOfferJourneys({ produtos: [{ nome: "Oferta", link: "https://page.test" }] }, [{ label: "Portal", kind: "area_membros", url: "https://members.test" }, { url: "https://page.test", image_url: "https://assets.test/page.jpg" }]);
    render(<OfferJourneys reading={reading} />);
    fireEvent.error(screen.getByRole("img", { hidden: true }));
    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument();
    expect(screen.getByText(/Print real não disponível/)).toBeInTheDocument();
    expect(screen.getByLabelText("Oferta: Área de membros")).toHaveTextContent("Não localizado neste cadastro");
    expect(screen.getByText(/Um elemento de obrigado ou membros aqui/)).toBeInTheDocument();
  });
});
