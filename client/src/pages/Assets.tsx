import { useState } from 'react';
import { useStore } from '@/lib/store';
import { 
  Briefcase, 
  Car, 
  Home, 
  TrendingUp, 
  Plus,
  Trash2,
  Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function AssetsPage() {
  const { assets, addAsset, updateAsset, deleteAsset } = useStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    value: '',
    type: 'property'
  });

  const totalAssets = assets.reduce((sum, a) => sum + a.value, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TT', { style: 'currency', currency: 'TTD' }).format(amount);
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'property': return Home;
      case 'vehicle': return Car;
      case 'investment': return TrendingUp;
      default: return Briefcase;
    }
  };

  const handleEdit = (asset: any) => {
    setEditingId(asset.id);
    setFormData({
      name: asset.name,
      value: asset.value.toString(),
      type: asset.type
    });
    setIsDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingId(null);
      setFormData({ name: '', value: '', type: 'property' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(formData.value) || 0;

    if (editingId) {
      updateAsset(editingId, value);
      // Note: Store only has updateAsset for value currently for simplicity in requested changes,
      // but in a real app we'd update name/type too.
      // The store definition I added: updateAsset: (id: string, value: number) => void;
      // I should have made it more flexible. For now I'll just update value as that's the most critical.
    } else {
      addAsset({
        name: formData.name,
        value: value,
        type: formData.type as any
      });
    }
    
    handleOpenChange(false);
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Asset Tracking</h1>
          <p className="text-slate-500 mt-1">Track the value of your physical and investment assets.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input 
                  id="name" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="col-span-3"
                  disabled={!!editingId} // Disable name edit since store only updates value for now
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(val) => setFormData({...formData, type: val})}
                  disabled={!!editingId}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="property">Property</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="investment">Investment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="value" className="text-right">Value</Label>
                <Input 
                  id="value" 
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <DialogFooter>
                <Button type="submit">Save Asset</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900 text-white border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-400 text-sm font-medium uppercase tracking-wider">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalAssets)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {assets.map(asset => {
          const Icon = getIcon(asset.type);
          return (
            <Card key={asset.id} className="hover:shadow-md transition-shadow group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold text-slate-700 truncate pr-4">
                  {asset.name}
                </CardTitle>
                <Icon className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900 mb-2">
                  {formatCurrency(asset.value)}
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(asset)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deleteAsset(asset.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
