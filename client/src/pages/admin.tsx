
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, LogOut } from "lucide-react";
import type { Product, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type AdminProps = {
  user: User;
  onLogout: () => void;
};

type ProductClick = {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  clickedAt: string;
};

export default function Admin({ user, onLogout }: AdminProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    categoria: "",
    nome: "",
    descricao: "",
    preco: "",
    imagem: "",
    imagens: [] as string[],
    affiliateLink: "",
    destaque: 0,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: customers = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: userClicks = [] } = useQuery<ProductClick[]>({
    queryKey: ["/api/admin/user-clicks", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const res = await fetch(`/api/admin/user-clicks/${selectedUserId}`);
      return res.json();
    },
    enabled: !!selectedUserId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao criar produto");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produto criado com sucesso!" });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao atualizar produto");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produto atualizado com sucesso!" });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao deletar produto");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produto deletado com sucesso!" });
    },
  });

  const resetForm = () => {
    setFormData({
      categoria: "",
      nome: "",
      descricao: "",
      preco: "",
      imagem: "",
      imagens: [],
      affiliateLink: "",
      destaque: 0,
    });
    setEditingProduct(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
      imagens: formData.imagens.join(',')
    };
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      categoria: product.categoria,
      nome: product.nome,
      descricao: product.descricao || "",
      preco: product.preco,
      imagem: product.imagem,
      imagens: product.imagens ? product.imagens.split(',') : [],
      affiliateLink: product.affiliateLink,
      destaque: product.destaque,
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-br from-brand-pink/10 via-brand-orange/10 to-brand-blue/10 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
              <p className="text-muted-foreground mt-1">Olá, {user.name}!</p>
            </div>
            <Button onClick={onLogout} variant="outline" data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {/* Seção de Clientes Cadastrados */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Clientes Cadastrados</h2>
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Nome</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Telefone</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Data de Cadastro</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum cliente cadastrado ainda
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <>
                      <tr key={customer.id} className="border-t border-border">
                        <td className="px-4 py-3 text-sm">{customer.name}</td>
                        <td className="px-4 py-3 text-sm">{customer.email}</td>
                        <td className="px-4 py-3 text-sm">{customer.phone || "-"}</td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(customer.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedUserId(selectedUserId === customer.id ? null : customer.id)}
                          >
                            {selectedUserId === customer.id ? "Ocultar Cliques" : "Ver Cliques"}
                          </Button>
                        </td>
                      </tr>
                      {selectedUserId === customer.id && (
                        <tr className="border-t border-border bg-muted/30">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Produtos Clicados:</h4>
                              {userClicks.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhum clique registrado</p>
                              ) : (
                                <div className="space-y-1">
                                  {userClicks.map((click) => (
                                    <div key={click.id} className="text-sm flex justify-between items-center bg-card px-3 py-2 rounded">
                                      <span className="font-medium">{click.productName}</span>
                                      <span className="text-muted-foreground text-xs">
                                        {new Date(click.clickedAt).toLocaleString('pt-BR')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Seção de Produtos */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Gerenciar Produtos</h2>
          <Button onClick={handleNew} className="bg-brand-pink hover:bg-brand-pink/90" data-testid="button-new-product">
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
        </div>

        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Imagem</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Nome</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Categoria</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Preço</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Link Afiliado</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Destaque</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <img src={product.imagem} alt={product.nome} className="w-12 h-12 object-cover rounded" />
                  </td>
                  <td className="px-4 py-3 text-sm">{product.nome}</td>
                  <td className="px-4 py-3 text-sm">{product.categoria}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-brand-pink">{product.preco}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-xs">
                    {product.affiliateLink || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm">{product.destaque ? "⭐ Sim" : "Não"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(product)} data-testid={`button-edit-${product.id}`}>
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteMutation.mutate(product.id)}
                        data-testid={`button-delete-${product.id}`}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                  data-testid="input-product-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="Eletrônicos e Celulares">Eletrônicos e Celulares</SelectItem>
                    <SelectItem value="Casa e Eletrodomésticos">Casa e Eletrodomésticos</SelectItem>
                    <SelectItem value="Esportes e Fitness">Esportes e Fitness</SelectItem>
                    <SelectItem value="Ferramentas">Ferramentas</SelectItem>
                    <SelectItem value="Moda">Moda</SelectItem>
                    <SelectItem value="Beleza e Cuidado Pessoal">Beleza e Cuidado Pessoal</SelectItem>
                    <SelectItem value="Saúde">Saúde</SelectItem>
                    <SelectItem value="Bebês">Bebês</SelectItem>
                    <SelectItem value="Brinquedos e Hobbies">Brinquedos e Hobbies</SelectItem>
                    <SelectItem value="Papelaria">Papelaria</SelectItem>
                    <SelectItem value="Games">Games</SelectItem>
                    <SelectItem value="Informática">Informática</SelectItem>
                    <SelectItem value="Agro">Agro</SelectItem>
                    <SelectItem value="Indústria e Comércio">Indústria e Comércio</SelectItem>
                    <SelectItem value="Alimentos e Bebidas">Alimentos e Bebidas</SelectItem>
                    <SelectItem value="Serviços">Serviços</SelectItem>
                    <SelectItem value="Câmeras e Acessórios">Câmeras e Acessórios</SelectItem>
                    <SelectItem value="Pet Shop">Pet Shop</SelectItem>
                    <SelectItem value="Antiguidades e Coleções">Antiguidades e Coleções</SelectItem>
                    <SelectItem value="Outras Categorias">Outras Categorias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição do produto"
                rows={3}
                data-testid="input-product-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Preço</Label>
              <Input
                value={formData.preco}
                onChange={(e) => setFormData({ ...formData, preco: e.target.value })}
                placeholder="R$ 99,90"
                required
                data-testid="input-product-price"
              />
            </div>
            <div className="space-y-2">
              <Label>URL da Imagem Principal</Label>
              <Input
                value={formData.imagem}
                onChange={(e) => setFormData({ ...formData, imagem: e.target.value })}
                required
                data-testid="input-product-image"
              />
            </div>
            <div className="space-y-2">
              <Label>Galeria de Imagens (até 8 fotos)</Label>
              <div className="space-y-2">
                {formData.imagens.map((img, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={img}
                      onChange={(e) => {
                        const newImages = [...formData.imagens];
                        newImages[index] = e.target.value;
                        setFormData({ ...formData, imagens: newImages });
                      }}
                      placeholder={`URL da imagem ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const newImages = formData.imagens.filter((_, i) => i !== index);
                        setFormData({ ...formData, imagens: newImages });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {formData.imagens.length < 8 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormData({ ...formData, imagens: [...formData.imagens, ''] })}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Imagem
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Link de Afiliado</Label>
              <Input
                value={formData.affiliateLink}
                onChange={(e) => setFormData({ ...formData, affiliateLink: e.target.value })}
                required
                data-testid="input-product-affiliate-link"
              />
            </div>
            <div className="space-y-2">
              <Label>Produto em Destaque?</Label>
              <Select
                value={String(formData.destaque)}
                onValueChange={(v) => setFormData({ ...formData, destaque: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Não</SelectItem>
                  <SelectItem value="1">Sim</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-product">
                Cancelar
              </Button>
              <Button type="submit" className="bg-brand-pink hover:bg-brand-pink/90" data-testid="button-submit-product">
                {editingProduct ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
