import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { taskAPI, organizationAPI } from '@/utils/api';
import { ArrowLeft, Plus, Edit, Trash2, Clock, Calendar, CheckCircle2, Circle, AlertCircle } from 'lucide-react';

const TasksPage = ({ user }) => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, [orgId, activeFilter]);

  const fetchData = async () => {
    try {
      const params = {};
      if (activeFilter === 'my-tasks') params.assigned_to_me = true;
      if (activeFilter === 'daily') params.is_daily = true;
      if (['pending', 'about_to_do', 'completed'].includes(activeFilter)) params.status = activeFilter;

      const [tasksRes, membersRes] = await Promise.all([
        taskAPI.getAll(orgId, params),
        organizationAPI.getMembers(orgId),
      ]);
      setTasks(tasksRes.data);
      setMembers(membersRes.data);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const data = {
      title: formData.get('title'),
      description: formData.get('description'),
      assigned_to: formData.get('assigned_to') || null,
      status: formData.get('status'),
      duration_minutes: formData.get('duration') ? parseInt(formData.get('duration')) : null,
      is_daily: formData.get('is_daily') === 'on',
      due_date: formData.get('due_date') || null,
    };

    try {
      await taskAPI.create(orgId, data);
      toast.success('Task created successfully!');
      setCreateDialogOpen(false);
      fetchData();
      e.target.reset();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create task');
    }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const data = {
      title: formData.get('title'),
      description: formData.get('description'),
      assigned_to: formData.get('assigned_to') || null,
      status: formData.get('status'),
      duration_minutes: formData.get('duration') ? parseInt(formData.get('duration')) : null,
      is_daily: formData.get('is_daily') === 'on',
      due_date: formData.get('due_date') || null,
    };

    try {
      await taskAPI.update(orgId, editingTask.id, data);
      toast.success('Task updated successfully!');
      setEditingTask(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      await taskAPI.delete(orgId, taskId);
      toast.success('Task deleted successfully!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete task');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'about_to_do':
        return <AlertCircle className="h-5 w-5 text-blue-600" />;
      default:
        return <Circle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const TaskForm = ({ task, onSubmit, isEditing }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          name="title"
          defaultValue={task?.title}
          placeholder="Task title"
          required
          data-testid="task-title-input"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-description">Description</Label>
        <Textarea
          id="task-description"
          name="description"
          defaultValue={task?.description}
          placeholder="Task description"
          rows={3}
          data-testid="task-description-input"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="task-status">Status</Label>
          <Select name="status" defaultValue={task?.status || 'pending'}>
            <SelectTrigger data-testid="task-status-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="about_to_do">About to Do</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-assigned">Assign To</Label>
          <Select name="assigned_to" defaultValue={task?.assigned_to || ''}>
            <SelectTrigger data-testid="task-assigned-select">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Unassigned</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="task-duration">Duration (minutes)</Label>
          <Input
            id="task-duration"
            name="duration"
            type="number"
            defaultValue={task?.duration_minutes}
            placeholder="60"
            min="1"
            data-testid="task-duration-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-due-date">Due Date</Label>
          <Input
            id="task-due-date"
            name="due_date"
            type="date"
            defaultValue={task?.due_date}
            data-testid="task-due-date-input"
          />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Switch id="task-daily" name="is_daily" defaultChecked={task?.is_daily} data-testid="task-daily-switch" />
        <Label htmlFor="task-daily" className="cursor-pointer">Daily Task</Label>
      </div>
      <Button type="submit" className="w-full" data-testid="task-submit-button">
        {isEditing ? 'Update Task' : 'Create Task'}
      </Button>
    </form>
  );

  return (
    <div className="dashboard-container" data-testid="tasks-page">
      <div className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/organization/${orgId}`)} data-testid="back-to-org-button">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Tasks</h1>
                <p className="text-sm text-muted-foreground mt-1">{tasks.length} tasks</p>
              </div>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="create-task-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="create-task-dialog">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>
                    Add a new task to your organization
                  </DialogDescription>
                </DialogHeader>
                <TaskForm onSubmit={handleCreateTask} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeFilter} onValueChange={setActiveFilter} className="mb-6">
          <TabsList>
            <TabsTrigger value="all" data-testid="filter-all">All Tasks</TabsTrigger>
            <TabsTrigger value="my-tasks" data-testid="filter-my-tasks">My Tasks</TabsTrigger>
            <TabsTrigger value="pending" data-testid="filter-pending">Pending</TabsTrigger>
            <TabsTrigger value="about_to_do" data-testid="filter-in-progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed" data-testid="filter-completed">Completed</TabsTrigger>
            <TabsTrigger value="daily" data-testid="filter-daily">Daily</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Tasks Found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first task to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4" data-testid="tasks-list">
            {tasks.map((task) => (
              <Card key={task.id} className="task-card glass-card" data-testid={`task-card-${task.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(task.status)}
                        <CardTitle className="text-lg">{task.title}</CardTitle>
                      </div>
                      {task.description && (
                        <CardDescription className="mt-2">{task.description}</CardDescription>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                        {task.assigned_to_name && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Assigned to:</span> {task.assigned_to_name}
                          </span>
                        )}
                        {task.duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {task.duration_minutes} min
                          </span>
                        )}
                        {task.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {task.is_daily && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                            Daily
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`status-badge status-${task.status}`}>
                        {task.status === 'about_to_do' ? 'In Progress' : task.status}
                      </span>
                      <Dialog open={editingTask?.id === task.id} onOpenChange={(open) => !open && setEditingTask(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingTask(task)}
                            data-testid={`edit-task-${task.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent data-testid="edit-task-dialog">
                          <DialogHeader>
                            <DialogTitle>Edit Task</DialogTitle>
                            <DialogDescription>
                              Update task details
                            </DialogDescription>
                          </DialogHeader>
                          <TaskForm task={task} onSubmit={handleUpdateTask} isEditing />
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTask(task.id)}
                        data-testid={`delete-task-${task.id}`}
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
      </div>
    </div>
  );
};

export default TasksPage;