# Bug 修复说明

## 问题 1: 任务拖入司机列后消失

### 原因
- 旧系统：拖拽订单只创建 `dispatch_assignments` 记录
- 新系统：DriverColumn 组件从 `job_steps` 表读取数据
- 结果：创建了 assignment 但没有对应的 job_steps，导致任务"消失"

### 解决方案
更新 `saveAllChanges` mutation，在创建 assignment 的同时自动创建对应的 job_steps：

```typescript
// 插入新的 assignments 和 job_steps
for (const i of inserts) {
  // 1. 插入 assignment
  const { data: newAssignment } = await supabase
    .from("dispatch_assignments")
    .insert({...})
    .select()
    .single();
  
  // 2. 根据订单类型创建 job_steps
  const steps = [];
  if (order.type === "delivery") {
    steps.push({
      assignment_id: newAssignment.id,
      driver_id: i.driver_id,
      scheduled_date: i.scheduled_date,
      order_id: order.id,
      node_type: 'order',
      step_number: i.sequence,
      step_type: 'delivery',
      location: order.address,
      status: 'locked',
    });
  }
  // ... 其他订单类型
  
  // 3. 插入 job_steps
  await supabase.from("job_steps").insert(steps);
}
```

### 数据流
```
拖拽订单到司机列
  ↓
创建临时 assignment (temp-xxx)
  ↓
点击"同步修改"
  ↓
saveAllChanges mutation
  ↓
1. 插入 dispatch_assignments
2. 自动创建对应的 job_steps
  ↓
刷新查询
  ↓
DriverColumn 从 job_steps 读取并显示
```

## 问题 2: Select 组件空值错误

### 错误信息
```
A <Select.Item /> must have a value prop that is not an empty string. 
This is because the Select value can be set to an empty string to clear 
the selection and show the placeholder.
```

### 原因
- Select 组件不允许 `value=""` 的 SelectItem
- 桶号选择器使用了空字符串作为"不指定"选项

### 解决方案
使用 `"none"` 作为占位值，在 onChange 时转换：

```typescript
// 修复前
<Select value={binId} onValueChange={setBinId}>
  <SelectItem value="" className="text-xs">不指定</SelectItem>
  ...
</Select>

// 修复后
<Select value={binId || "none"} onValueChange={(v) => setBinId(v === "none" ? "" : v)}>
  <SelectItem value="none" className="text-xs">不指定</SelectItem>
  ...
</Select>
```

## 问题 3: DriverColumn 节点显示逻辑

### 优化
改进了 allNodes 的计算逻辑，处理以下情况：
1. Assignment 有对应的 job_steps - 使用 step_number
2. Assignment 没有对应的 job_steps - 使用 sequence 作为 stepNumber（向后兼容）
3. 手动步骤节点 - 直接使用 step_number

```typescript
const allNodes = useMemo(() => {
  const nodes = [];
  
  // 订单节点
  assignments.forEach(a => {
    const assignmentSteps = jobSteps.filter(s => s.assignment_id === a.id);
    if (assignmentSteps.length > 0) {
      nodes.push({ type: 'order', data: a, stepNumber: assignmentSteps[0].step_number });
    } else {
      // 向后兼容：没有 job_steps 时使用 sequence
      nodes.push({ type: 'order', data: a, stepNumber: a.sequence });
    }
  });
  
  // 手动步骤节点
  jobSteps.filter(s => s.node_type === 'step').forEach(s => {
    nodes.push({ type: 'step', data: s, stepNumber: s.step_number });
  });
  
  return nodes.sort((a, b) => a.stepNumber - b.stepNumber);
}, [assignments, jobSteps]);
```

## 测试清单

### ✅ 拖拽功能
- [ ] 从待排班列表拖拽订单到司机列
- [ ] 点击"同步修改"按钮
- [ ] 刷新页面，验证订单仍然显示
- [ ] 检查数据库：dispatch_assignments 和 job_steps 都有记录

### ✅ 插入步骤功能
- [ ] 点击 "+ 插入步骤" 按钮
- [ ] 选择地点（Kennedy Depot 或 Sheppard Yard）
- [ ] 选择动作（取桶、放桶等）
- [ ] 桶号选择"不指定"（不应该报错）
- [ ] 填写备注
- [ ] 点击"确认插入"
- [ ] 验证步骤已插入

### ✅ 司机端显示
- [ ] 登录司机账号
- [ ] 查看今天的任务列表
- [ ] 验证订单节点和步骤节点都显示
- [ ] 验证步骤锁定逻辑正常

## 数据库验证

运行以下 SQL 验证数据完整性：

```sql
-- 检查 assignment 和 job_steps 的关联
SELECT 
  da.id as assignment_id,
  da.order_id,
  da.driver_id,
  da.sequence,
  js.id as step_id,
  js.step_number,
  js.node_type,
  js.step_type
FROM dispatch_assignments da
LEFT JOIN job_steps js ON js.assignment_id = da.id
WHERE da.scheduled_date = CURRENT_DATE
ORDER BY da.driver_id, da.sequence;

-- 检查是否有孤立的 assignments（没有对应的 job_steps）
SELECT 
  da.*
FROM dispatch_assignments da
LEFT JOIN job_steps js ON js.assignment_id = da.id
WHERE da.scheduled_date = CURRENT_DATE
  AND js.id IS NULL;

-- 检查手动步骤
SELECT 
  js.*
FROM job_steps js
WHERE js.scheduled_date = CURRENT_DATE
  AND js.node_type = 'step'
ORDER BY js.driver_id, js.step_number;
```

## 已知限制

1. **拖拽排序未实现**
   - 当前只能通过"同步修改"保存顺序
   - 拖拽调整顺序后需要点击按钮保存

2. **步骤编号可能不连续**
   - 删除步骤后，编号会重新计算
   - 插入步骤时，后续步骤编号 +1

3. **向后兼容性**
   - 旧数据（没有 job_steps）仍然可以显示
   - 使用 sequence 作为 stepNumber

## 下一步改进

1. **实时同步**
   - 拖拽后自动保存，无需点击按钮
   - 使用乐观更新提升体验

2. **批量操作**
   - 批量创建 job_steps
   - 使用事务确保数据一致性

3. **错误处理**
   - 更详细的错误提示
   - 失败时自动回滚

4. **性能优化**
   - 减少数据库查询次数
   - 使用 join 一次性获取所有数据
