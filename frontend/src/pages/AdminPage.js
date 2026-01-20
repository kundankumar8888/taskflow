import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { adminAPI } from '@/utils/api';
import { ArrowLeft, Plus, Edit, Trash2, Shield, Eye, EyeOff } from 'lucide-react';

const AdminPage = ({ user }) => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});
  const [hasAccess, setHasAccess] = useState(true);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await adminAPI.getConfig();
      setConfigs(response.data);
      setHasAccess(true);
    } catch (error) {
      if (error.response?.status === 403) {
        setHasAccess(false);
        toast.error('You do not have system admin access');
      } else {
        toast.error('Failed to load configurations');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConfig = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const data = {
      key_name: formData.get('key_name'),
      value: formData.get('value'),
      is_secret: formData.get('is_secret') === 'on',
    };

    try {
      await adminAPI.updateConfig(data);
      toast.success('Configuration saved successfully!');
      setCreateDialogOpen(false);
      fetchConfigs();
      e.target.reset();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save configuration');
    }
  };

  const handleDeleteConfig = async (keyName) => {
    if (!window.confirm('Are you sure you want to delete this configuration?')) return;

    try {
      await adminAPI.deleteConfig(keyName);
      toast.success('Configuration deleted successfully!');
      fetchConfigs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete configuration');
    }
  };

  const toggleSecretVisibility = (keyName) => {
    setShowSecrets(prev => ({
      ...prev,
      [keyName]: !prev[keyName]
    }));
  };

  if (!hasAccess) {
    return (
      <div className="dashboard-container" data-testid="admin-page-no-access">
        <div className="border-b bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} data-testid="back-button">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto text-center py-12">
            <CardContent>
              <Shield className="h-16 w-16 mx-auto mb-4 text-red-500" />
              <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
              <p className="text-muted-foreground">
                You do not have system administrator privileges. Contact your system admin to get access.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" data-testid="admin-page">
      <div className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} data-testid="back-button">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-6 w-6 text-blue-600" />
                  <h1 className="text-2xl font-bold">Admin Panel</h1>
                </div>
                <p className="text-sm text-muted-foreground mt-1">System configuration management</p>
              </div>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="add-config-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Configuration
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="add-config-dialog">
                <DialogHeader>
                  <DialogTitle>Add Configuration</DialogTitle>
                  <DialogDescription>
                    Create or update a system configuration variable
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateConfig} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="config-key">Key Name</Label>
                    <Input
                      id="config-key"
                      name="key_name"
                      placeholder="API_KEY"
                      required
                      data-testid="config-key-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="config-value">Value</Label>
                    <Input
                      id="config-value"
                      name="value"
                      placeholder="configuration value"
                      required
                      data-testid="config-value-input"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="config-secret" name="is_secret" data-testid="config-secret-switch" />
                    <Label htmlFor="config-secret" className="cursor-pointer">Mark as Secret</Label>
                  </div>
                  <Button type="submit" className="w-full" data-testid="config-submit-button">
                    Save Configuration
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading configurations...</p>
          </div>
        ) : configs.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Configurations</h3>
              <p className="text-muted-foreground mb-4">
                Add your first configuration to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" data-testid="configs-list">
            {configs.map((config) => (
              <Card key={config.key_name} className="glass-card" data-testid={`config-${config.key_name}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {config.key_name}
                        {config.is_secret && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                            SECRET
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-2 font-mono">
                        {config.is_secret && !showSecrets[config.key_name]
                          ? '•'.repeat(20)
                          : config.value}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {config.is_secret && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSecretVisibility(config.key_name)}
                          data-testid={`toggle-secret-${config.key_name}`}
                        >
                          {showSecrets[config.key_name] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteConfig(config.key_name)}
                        data-testid={`delete-config-${config.key_name}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-8 glass-card">
          <CardHeader>
            <CardTitle>About Admin Panel</CardTitle>
            <CardDescription>
              System-level configuration management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Only system administrators can access this panel</p>
              <p>• Configurations marked as "SECRET" are hidden by default</p>
              <p>• Use this to manage environment variables and system settings</p>
              <p>• Be careful when deleting configurations as this cannot be undone</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPage;