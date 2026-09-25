import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@material-ui/core";

import { makeStyles } from "@material-ui/core/styles";

import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteIcon from "@material-ui/icons/Delete";
import PaymentIcon from "@material-ui/icons/Payment";
import RefreshIcon from "@material-ui/icons/Refresh";
import ReplayIcon from "@material-ui/icons/Replay";

import { toast } from "react-toastify";

import api from "../../services/api";


const useStyles = makeStyles(theme => ({
  root: {
    padding: theme.spacing(2),
    width: "100%",
    height: "calc(100vh - 64px)",
    overflowY: "auto",
    overflowX: "hidden",
    boxSizing: "border-box",
    paddingBottom: theme.spacing(5)
  },

  header: {
    marginBottom: theme.spacing(2)
  },

  title: {
    fontWeight: 700
  },

  subtitle: {
    color: theme.palette.text.secondary,
    marginTop: 4
  },

  tabs: {
    marginBottom: theme.spacing(2)
  },

  summaryCard: {
    height: "100%",
    borderRadius: 12
  },

  summaryValue: {
    fontWeight: 700,
    marginTop: 6
  },

  toolbar: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(2)
  },

  toolbarLeft: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center"
  },

  table: {
    minWidth: 760
  },

  empty: {
    textAlign: "center",
    padding: theme.spacing(5),
    color: theme.palette.text.secondary
  },

  dialogField: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },

  reminderBox: {
    padding: theme.spacing(1.5),
    marginTop: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8
  },

  nextDue: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    borderRadius: 8,
    background: theme.palette.action.hover
  }
}));


const todayDate = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};


const formatDate = value => {
  if (!value) return "—";

  const raw = String(value).substring(0, 10);
  const parts = raw.split("-");

  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};


const formatMoney = value => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) return value;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(number);
};


const diffDays = dateOnly => {
  if (!dateOnly) return 0;

  const today = todayDate();

  const a = new Date(`${today}T12:00:00`);
  const b = new Date(`${String(dateOnly).substring(0, 10)}T12:00:00`);

  return Math.round(
    (b.getTime() - a.getTime()) /
    86400000
  );
};


const dueLabel = dateOnly => {
  const days = diffDays(dateOnly);

  if (days === 0) {
    return {
      text: "Vence hoje",
      color: "secondary"
    };
  }

  if (days === 1) {
    return {
      text: "Vence amanhã",
      color: "default"
    };
  }

  if (days > 1) {
    return {
      text: `Faltam ${days} dias`,
      color: "default"
    };
  }

  if (days === -1) {
    return {
      text: "Atrasado 1 dia",
      color: "secondary"
    };
  }

  return {
    text: `Atrasado ${Math.abs(days)} dias`,
    color: "secondary"
  };
};


const defaultMessageTemplates = {
  "3": "",
  "2": "",
  "1": "",
  "0": "",
  "-1": "",
  paymentConfirmation: ""
};


const defaultProduct = {
  name: "",
  description: "",
  amount: "",
  dueRule: "running_days",
  runningDays: 30,
  fixedDay: 10,
  renewFrom: "due_date",
  reminderTime: "09:00",
  reminderDays: [3, 2, 1, 0, -1],
  messageTemplates: {
    ...defaultMessageTemplates
  },
  active: true
};


const defaultCustomer = {
  name: "",
  phone: "",
  notes: "",
  active: true
};


const defaultSubscription = {
  customerId: "",
  productId: "",
  whatsappId: "",
  dueDate: todayDate(),
  status: "active",
  active: true
};


const reminderOptions = [
  { value: 3, label: "3 dias antes" },
  { value: 2, label: "2 dias antes" },
  { value: 1, label: "1 dia antes" },
  { value: 0, label: "No vencimento" },
  { value: -1, label: "1 dia depois" }
];


const Renewals = () => {
  const classes = useStyles();

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [failures, setFailures] = useState([]);
  const [whatsapps, setWhatsapps] = useState([]);

  const [searchProduct, setSearchProduct] = useState("");
  const [searchCustomer, setSearchCustomer] = useState("");
  const [searchSubscription, setSearchSubscription] = useState("");

  const [productModal, setProductModal] = useState(false);
  const [productEditing, setProductEditing] = useState(null);
  const [productForm, setProductForm] = useState(defaultProduct);

  const [customerModal, setCustomerModal] = useState(false);
  const [customerEditing, setCustomerEditing] = useState(null);
  const [customerForm, setCustomerForm] = useState(defaultCustomer);

  const [subscriptionModal, setSubscriptionModal] = useState(false);
  const [subscriptionEditing, setSubscriptionEditing] = useState(null);
  const [subscriptionForm, setSubscriptionForm] = useState(
    defaultSubscription
  );

  const [renewModal, setRenewModal] = useState(false);
  const [renewSubscription, setRenewSubscription] = useState(null);

  const [renewForm, setRenewForm] = useState({
    paymentDate: todayDate(),
    amount: "",
    notes: ""
  });

  const [nextDuePreview, setNextDuePreview] = useState(null);
  const [saving, setSaving] = useState(false);


  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [
        productResponse,
        customerResponse,
        subscriptionResponse,
        paymentResponse,
        failureResponse,
        whatsappResponse
      ] = await Promise.all([
        api.get("/renewals/products"),
        api.get("/renewals/customers"),
        api.get("/renewals/subscriptions"),
        api.get("/renewals/payments"),
        api.get("/renewals/notifications/failures"),
        api.get("/whatsapp")
      ]);

      setProducts(
        productResponse.data?.products || []
      );

      setCustomers(
        customerResponse.data?.customers || []
      );

      setSubscriptions(
        subscriptionResponse.data?.subscriptions || []
      );

      setPayments(
        paymentResponse.data?.payments || []
      );

      setFailures(
        failureResponse.data?.notifications || []
      );

      const whatsappData =
        whatsappResponse.data?.whatsapps ||
        whatsappResponse.data?.records ||
        whatsappResponse.data ||
        [];

      setWhatsapps(
        Array.isArray(whatsappData)
          ? whatsappData
          : []
      );

    } catch (error) {
      console.error(error);
      toast.error(
        "Erro ao carregar o módulo de renovações."
      );
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    loadData();
  }, [loadData]);


  const overview = useMemo(() => {
    const activeSubscriptions =
      subscriptions.filter(item =>
        item.active !== false &&
        item.status !== "canceled"
      );

    const dueToday = activeSubscriptions.filter(
      item => diffDays(item.dueDate) === 0
    ).length;

    const next3Days = activeSubscriptions.filter(item => {
      const days = diffDays(item.dueDate);
      return days >= 1 && days <= 3;
    }).length;

    const overdue = activeSubscriptions.filter(
      item => diffDays(item.dueDate) < 0
    ).length;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const received = payments.reduce(
      (total, payment) => {
        if (!payment.paidAt) return total;

        const date = new Date(payment.paidAt);

        if (
          date.getMonth() === currentMonth &&
          date.getFullYear() === currentYear
        ) {
          return total + Number(payment.amount || 0);
        }

        return total;
      },
      0
    );

    return {
      dueToday,
      next3Days,
      overdue,
      received
    };
  }, [subscriptions, payments]);


  const filteredProducts = useMemo(() => {
    const search = searchProduct
      .trim()
      .toLowerCase();

    if (!search) return products;

    return products.filter(item =>
      String(item.name || "")
        .toLowerCase()
        .includes(search)
    );
  }, [products, searchProduct]);


  const filteredCustomers = useMemo(() => {
    const search = searchCustomer
      .trim()
      .toLowerCase();

    if (!search) return customers;

    return customers.filter(item =>
      String(item.name || "")
        .toLowerCase()
        .includes(search) ||
      String(item.phone || "")
        .includes(search)
    );
  }, [customers, searchCustomer]);


  const filteredSubscriptions = useMemo(() => {
    const search = searchSubscription
      .trim()
      .toLowerCase();

    if (!search) return subscriptions;

    return subscriptions.filter(item => {
      const customer =
        item.customer?.name || "";

      const phone =
        item.customer?.phone || "";

      const product =
        item.product?.name || "";

      return (
        customer.toLowerCase().includes(search) ||
        phone.includes(search) ||
        product.toLowerCase().includes(search)
      );
    });
  }, [subscriptions, searchSubscription]);


  const openProduct = product => {
    if (product) {
      setProductEditing(product);

      setProductForm({
        name: product.name || "",
        description: product.description || "",
        amount: product.amount ?? "",
        dueRule:
          product.dueRule || "running_days",
        runningDays:
          product.runningDays || 30,
        fixedDay:
          product.fixedDay || 10,
        renewFrom:
          product.renewFrom || "due_date",
        reminderTime:
          product.reminderTime || "09:00",

        reminderDays:
          Array.isArray(product.reminderDays)
            ? product.reminderDays
            : [3, 2, 1, 0, -1],

        messageTemplates: {
          ...defaultMessageTemplates,
          ...(product.messageTemplates || {})
        },

        active:
          product.active !== false
      });
    } else {
      setProductEditing(null);
      setProductForm({
        ...defaultProduct
      });
    }

    setProductModal(true);
  };


  const saveProduct = async () => {
    try {
      setSaving(true);

      const payload = {
        ...productForm,
        amount:
          productForm.amount === ""
            ? null
            : Number(productForm.amount),

        runningDays:
          productForm.dueRule === "running_days"
            ? Number(productForm.runningDays)
            : null,

        fixedDay:
          productForm.dueRule === "fixed_day"
            ? Number(productForm.fixedDay)
            : null
      };

      if (productEditing) {
        await api.put(
          `/renewals/products/${productEditing.id}`,
          payload
        );

        toast.success(
          "Produto atualizado com sucesso."
        );
      } else {
        await api.post(
          "/renewals/products",
          payload
        );

        toast.success(
          "Produto criado com sucesso."
        );
      }

      setProductModal(false);
      await loadData();

    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
        "Erro ao salvar produto."
      );
    } finally {
      setSaving(false);
    }
  };


  const deactivateProduct = async product => {
    if (
      !window.confirm(
        `Desativar o produto "${product.name}"?`
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/renewals/products/${product.id}`
      );

      toast.success(
        "Produto desativado."
      );

      await loadData();

    } catch (error) {
      toast.error(
        "Erro ao desativar produto."
      );
    }
  };


  const updateMessageTemplate = (
    key,
    value
  ) => {
    setProductForm(prev => ({
      ...prev,

      messageTemplates: {
        ...defaultMessageTemplates,
        ...(prev.messageTemplates || {}),
        [key]: value
      }
    }));
  };


  const toggleReminder = value => {
    setProductForm(prev => {
      const exists =
        prev.reminderDays.includes(value);

      return {
        ...prev,
        reminderDays: exists
          ? prev.reminderDays.filter(
              item => item !== value
            )
          : [...prev.reminderDays, value]
      };
    });
  };


  const openCustomer = customer => {
    if (customer) {
      setCustomerEditing(customer);

      setCustomerForm({
        name: customer.name || "",
        phone: customer.phone || "",
        notes: customer.notes || "",
        active:
          customer.active !== false
      });
    } else {
      setCustomerEditing(null);
      setCustomerForm({
        ...defaultCustomer
      });
    }

    setCustomerModal(true);
  };


  const saveCustomer = async () => {
    try {
      setSaving(true);

      if (customerEditing) {
        await api.put(
          `/renewals/customers/${customerEditing.id}`,
          customerForm
        );

        toast.success(
          "Cliente atualizado com sucesso."
        );
      } else {
        await api.post(
          "/renewals/customers",
          customerForm
        );

        toast.success(
          "Cliente cadastrado com sucesso."
        );
      }

      setCustomerModal(false);
      await loadData();

    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
        "Erro ao salvar cliente."
      );
    } finally {
      setSaving(false);
    }
  };


  const deactivateCustomer = async customer => {
    if (
      !window.confirm(
        `Desativar o cliente "${customer.name}"?`
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/renewals/customers/${customer.id}`
      );

      toast.success(
        "Cliente desativado."
      );

      await loadData();

    } catch (error) {
      toast.error(
        "Erro ao desativar cliente."
      );
    }
  };


  const openSubscription = subscription => {
    if (subscription) {
      setSubscriptionEditing(
        subscription
      );

      setSubscriptionForm({
        customerId:
          subscription.customerId || "",
        productId:
          subscription.productId || "",
        whatsappId:
          subscription.whatsappId || "",
        dueDate:
          String(subscription.dueDate || "")
            .substring(0, 10),
        status:
          subscription.status || "active",
        active:
          subscription.active !== false
      });
    } else {
      setSubscriptionEditing(null);

      setSubscriptionForm({
        ...defaultSubscription,
        dueDate: todayDate()
      });
    }

    setSubscriptionModal(true);
  };


  const saveSubscription = async () => {
    try {
      setSaving(true);

      const payload = {
        ...subscriptionForm,

        customerId:
          Number(subscriptionForm.customerId),

        productId:
          Number(subscriptionForm.productId),

        whatsappId:
          subscriptionForm.whatsappId
            ? Number(subscriptionForm.whatsappId)
            : null
      };

      if (subscriptionEditing) {
        await api.put(
          `/renewals/subscriptions/${subscriptionEditing.id}`,
          payload
        );

        toast.success(
          "Assinatura atualizada."
        );
      } else {
        await api.post(
          "/renewals/subscriptions",
          payload
        );

        toast.success(
          "Assinatura criada. A régua de lembretes foi preparada."
        );
      }

      setSubscriptionModal(false);
      await loadData();

    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
        "Erro ao salvar assinatura."
      );
    } finally {
      setSaving(false);
    }
  };


  const cancelSubscription = async subscription => {
    if (
      !window.confirm(
        `Cancelar a assinatura de "${subscription.customer?.name || "cliente"}"?`
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/renewals/subscriptions/${subscription.id}`
      );

      toast.success(
        "Assinatura cancelada."
      );

      await loadData();

    } catch (error) {
      toast.error(
        "Erro ao cancelar assinatura."
      );
    }
  };


  const loadRenewPreview = async (
    subscription,
    paymentDate
  ) => {
    if (
      !subscription ||
      !paymentDate
    ) {
      setNextDuePreview(null);
      return;
    }

    try {
      const { data } = await api.get(
        `/renewals/subscriptions/${subscription.id}/preview-next-due-date`,
        {
          params: {
            paymentDate
          }
        }
      );

      setNextDuePreview(data);

    } catch (error) {
      setNextDuePreview(null);
    }
  };


  const openRenew = subscription => {
    const paymentDate = todayDate();

    setRenewSubscription(subscription);

    setRenewForm({
      paymentDate,
      amount:
        subscription.product?.amount ?? "",
      notes: ""
    });

    setRenewModal(true);

    loadRenewPreview(
      subscription,
      paymentDate
    );
  };


  const saveRenew = async () => {
    if (!renewSubscription) return;

    try {
      setSaving(true);

      const { data } = await api.post(
        `/renewals/subscriptions/${renewSubscription.id}/renew`,
        {
          expectedDueDate:
            String(
              renewSubscription.dueDate
            ).substring(0, 10),

          paymentDate:
            renewForm.paymentDate,

          amount:
            renewForm.amount === ""
              ? null
              : Number(renewForm.amount),

          notes:
            renewForm.notes || null
        }
      );

      if (data.thankYouSent) {
        toast.success(
          `Baixa confirmada. Próximo vencimento: ${formatDate(data.nextDueDate)}. Agradecimento enviado.`
        );
      } else {
        toast.success(
          `Baixa confirmada. Próximo vencimento: ${formatDate(data.nextDueDate)}.`
        );

        if (data.thankYouError) {
          toast.warning(
            `A baixa foi registrada, mas o agradecimento não foi enviado: ${data.thankYouError}`
          );
        }
      }

      setRenewModal(false);
      setRenewSubscription(null);
      setNextDuePreview(null);

      await loadData();

    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
        "Erro ao dar baixa."
      );
    } finally {
      setSaving(false);
    }
  };


  const retryFailureNow = async notification => {
    try {
      setSaving(true);

      await api.post(
        `/renewals/notifications/${notification.id}/retry`
      );

      toast.success(
        "Notificação liberada para reenvio."
      );

      await loadData();

    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
        "Erro ao liberar a notificação para reenvio."
      );

    } finally {
      setSaving(false);
    }
  };


  const cancelFailure = async notification => {
    const confirmed = window.confirm(
      "Deseja cancelar as próximas tentativas desta notificação?"
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      await api.post(
        `/renewals/notifications/${notification.id}/cancel`
      );

      toast.success(
        "Tentativa de envio cancelada."
      );

      await loadData();

    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
        "Erro ao cancelar a tentativa."
      );

    } finally {
      setSaving(false);
    }
  };


  const renderOverview = () => (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={3}>
        <Card
          variant="outlined"
          className={classes.summaryCard}
        >
          <CardContent>
            <Typography color="textSecondary">
              Vencendo hoje
            </Typography>

            <Typography
              variant="h4"
              className={classes.summaryValue}
            >
              {overview.dueToday}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card
          variant="outlined"
          className={classes.summaryCard}
        >
          <CardContent>
            <Typography color="textSecondary">
              Próximos 3 dias
            </Typography>

            <Typography
              variant="h4"
              className={classes.summaryValue}
            >
              {overview.next3Days}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card
          variant="outlined"
          className={classes.summaryCard}
        >
          <CardContent>
            <Typography color="textSecondary">
              Atrasados
            </Typography>

            <Typography
              variant="h4"
              className={classes.summaryValue}
            >
              {overview.overdue}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card
          variant="outlined"
          className={classes.summaryCard}
        >
          <CardContent>
            <Typography color="textSecondary">
              Recebido no mês
            </Typography>

            <Typography
              variant="h5"
              className={classes.summaryValue}
            >
              {formatMoney(
                overview.received
              )}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Paper variant="outlined">
          <Box p={2}>
            <Typography variant="h6">
              Próximos vencimentos
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    Cliente
                  </TableCell>

                  <TableCell>
                    Produto
                  </TableCell>

                  <TableCell>
                    Vencimento
                  </TableCell>

                  <TableCell>
                    Situação
                  </TableCell>

                  <TableCell align="right">
                    Valor
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {subscriptions
                  .filter(
                    item =>
                      item.active !== false &&
                      item.status !== "canceled"
                  )
                  .slice()
                  .sort((a, b) =>
                    String(a.dueDate).localeCompare(
                      String(b.dueDate)
                    )
                  )
                  .slice(0, 10)
                  .map(item => {
                    const status =
                      dueLabel(item.dueDate);

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.customer?.name || "—"}
                        </TableCell>

                        <TableCell>
                          {item.product?.name || "—"}
                        </TableCell>

                        <TableCell>
                          {formatDate(item.dueDate)}
                        </TableCell>

                        <TableCell>
                          <Chip
                            size="small"
                            label={status.text}
                            color={status.color}
                          />
                        </TableCell>

                        <TableCell align="right">
                          {formatMoney(
                            item.product?.amount
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Grid>
    </Grid>
  );



  // ============================================================
  // BACKUP / RESTAURAÇÃO DO MÓDULO DE RENOVAÇÕES
  // ============================================================

  const handleExportRenewals = async () => {
    try {
      toast.info(
        "Preparando exportação das Renovações..."
      );

      const [
        productsResponse,
        customersResponse,
        subscriptionsResponse
      ] = await Promise.all([
        api.get("/renewals/products"),
        api.get("/renewals/customers"),
        api.get("/renewals/subscriptions")
      ]);

      const exportProducts =
        productsResponse.data?.products || [];

      const exportCustomers =
        customersResponse.data?.customers || [];

      const exportSubscriptions =
        subscriptionsResponse.data?.subscriptions || [];

      /*
       * Não exportamos IDs internos do banco.
       *
       * Assinaturas são relacionadas através de:
       * - telefone do cliente
       * - nome do produto
       * - nome da conexão
       *
       * Isso permite importar em outra instalação.
       */
      const backup = {
        type: "renewals-backup",
        version: 1,
        exportedAt: new Date().toISOString(),

        products: exportProducts.map(product => ({
          name: product.name,
          description: product.description || "",
          amount: product.amount,

          dueRule: product.dueRule,
          runningDays: product.runningDays,
          fixedDay: product.fixedDay,

          renewFrom: product.renewFrom,

          reminderDays:
            product.reminderDays || [3, 2, 1, 0, -1],

          reminderTime:
            product.reminderTime || "09:00",

          messageTemplates:
            product.messageTemplates || {},

          active:
            product.active !== false
        })),

        customers: exportCustomers.map(customer => ({
          name: customer.name,
          phone: customer.phone,
          notes: customer.notes || "",
          active:
            customer.active !== false
        })),

        subscriptions:
          exportSubscriptions.map(subscription => ({
            customerPhone:
              subscription.customer?.phone || "",

            productName:
              subscription.product?.name || "",

            whatsapp: {
              id:
                subscription.whatsappId || null,

              name:
                subscription.whatsapp?.name || null,

              channel:
                subscription.whatsapp?.channel || null,

              provider:
                subscription.whatsapp?.provider || null
            },

            dueDate:
              subscription.dueDate,

            lastPaymentAt:
              subscription.lastPaymentAt || null,

            status:
              subscription.status || "active",

            active:
              subscription.active !== false
          }))
      };

      const blob = new Blob(
        [
          JSON.stringify(
            backup,
            null,
            2
          )
        ],
        {
          type: "application/json;charset=utf-8"
        }
      );

      const url =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      const now =
        new Date();

      const stamp =
        [
          now.getFullYear(),
          String(
            now.getMonth() + 1
          ).padStart(2, "0"),
          String(
            now.getDate()
          ).padStart(2, "0")
        ].join("-");

      link.href = url;

      link.download =
        `renovacoes-backup-${stamp}.json`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);

      toast.success(
        `Exportação concluída: ` +
        `${backup.products.length} produto(s), ` +
        `${backup.customers.length} cliente(s) e ` +
        `${backup.subscriptions.length} assinatura(s).`
      );

    } catch (err) {
      console.error(
        "[RENEWALS] Erro ao exportar:",
        err
      );

      toast.error(
        err?.response?.data?.error ||
        "Não foi possível exportar as Renovações."
      );
    }
  };


  const handleImportRenewals = async event => {
    const input =
      event.target;

    const file =
      input.files?.[0];

    /*
     * Permite escolher novamente o mesmo arquivo.
     */
    input.value = "";

    if (!file) {
      return;
    }

    try {
      const text =
        await file.text();

      let backup;

      try {
        backup =
          JSON.parse(text);

      } catch (parseError) {
        throw new Error(
          "O arquivo selecionado não contém um JSON válido."
        );
      }

      if (
        !backup ||
        backup.type !== "renewals-backup" ||
        backup.version !== 1 ||
        !Array.isArray(backup.products) ||
        !Array.isArray(backup.customers) ||
        !Array.isArray(backup.subscriptions)
      ) {
        throw new Error(
          "Este arquivo não é uma exportação válida do módulo Renovações."
        );
      }

      const totalItems =
        backup.products.length +
        backup.customers.length +
        backup.subscriptions.length;

      if (totalItems > 10000) {
        throw new Error(
          "O arquivo contém itens demais para importação."
        );
      }

      const confirmed =
        window.confirm(
          `Importar configurações de Renovações?\n\n` +
          `Produtos: ${backup.products.length}\n` +
          `Clientes: ${backup.customers.length}\n` +
          `Assinaturas: ${backup.subscriptions.length}\n\n` +
          `Itens já existentes serão reaproveitados ou atualizados.`
        );

      if (!confirmed) {
        return;
      }

      toast.info(
        "Importando configurações de Renovações..."
      );


      // ========================================================
      // DADOS EXISTENTES
      // ========================================================

      const [
        currentProductsResponse,
        currentCustomersResponse,
        currentSubscriptionsResponse
      ] = await Promise.all([
        api.get("/renewals/products"),
        api.get("/renewals/customers"),
        api.get("/renewals/subscriptions")
      ]);

      let currentProducts =
        currentProductsResponse.data?.products || [];

      let currentCustomers =
        currentCustomersResponse.data?.customers || [];

      let currentSubscriptions =
        currentSubscriptionsResponse.data?.subscriptions || [];


      // ========================================================
      // CONEXÕES WHATSAPP
      // ========================================================

      let whatsappConnections = [];

      try {
        const whatsappResponse =
          await api.get("/whatsapp");

        whatsappConnections =
          whatsappResponse.data?.whatsapps ||
          whatsappResponse.data || [];

        if (
          !Array.isArray(
            whatsappConnections
          )
        ) {
          whatsappConnections = [];
        }

      } catch (err) {
        /*
         * A importação continua.
         * Caso não seja possível listar conexões,
         * a assinatura usará a conexão padrão.
         */
        console.warn(
          "[RENEWALS] Não foi possível listar conexões durante importação.",
          err
        );
      }


      const result = {
        productsCreated: 0,
        productsUpdated: 0,

        customersCreated: 0,
        customersUpdated: 0,

        subscriptionsCreated: 0,
        subscriptionsUpdated: 0,
        subscriptionsSkipped: 0
      };


      // ========================================================
      // PRODUTOS
      // ========================================================

      for (
        const importedProduct
        of backup.products
      ) {
        const name =
          String(
            importedProduct.name || ""
          ).trim();

        if (!name) {
          continue;
        }

        const payload = {
          name,

          description:
            importedProduct.description || "",

          amount:
            importedProduct.amount,

          dueRule:
            importedProduct.dueRule || "running_days",

          runningDays:
            importedProduct.runningDays || 30,

          fixedDay:
            importedProduct.fixedDay || null,

          renewFrom:
            importedProduct.renewFrom || "due_date",

          reminderDays:
            Array.isArray(
              importedProduct.reminderDays
            )
              ? importedProduct.reminderDays
              : [3, 2, 1, 0, -1],

          reminderTime:
            importedProduct.reminderTime || "09:00",

          messageTemplates:
            importedProduct.messageTemplates || {},

          active:
            importedProduct.active !== false
        };

        let existing =
          currentProducts.find(
            item =>
              String(
                item.name || ""
              )
                .trim()
                .toLowerCase() ===
              name.toLowerCase()
          );

        if (existing) {
          const response =
            await api.put(
              `/renewals/products/${existing.id}`,
              payload
            );

          existing =
            response.data;

          currentProducts =
            currentProducts.map(item =>
              item.id === existing.id
                ? existing
                : item
            );

          result.productsUpdated += 1;

        } else {
          const response =
            await api.post(
              "/renewals/products",
              payload
            );

          existing =
            response.data;

          currentProducts.push(
            existing
          );

          result.productsCreated += 1;
        }
      }


      // ========================================================
      // CLIENTES
      // ========================================================

      for (
        const importedCustomer
        of backup.customers
      ) {
        const phone =
          String(
            importedCustomer.phone || ""
          ).replace(/\D/g, "");

        if (!phone) {
          continue;
        }

        const payload = {
          name:
            String(
              importedCustomer.name || phone
            ).trim(),

          phone,

          notes:
            importedCustomer.notes || "",

          active:
            importedCustomer.active !== false
        };

        let existing =
          currentCustomers.find(
            item =>
              String(
                item.phone || ""
              ).replace(/\D/g, "") === phone
          );

        if (existing) {
          const response =
            await api.put(
              `/renewals/customers/${existing.id}`,
              payload
            );

          existing =
            response.data;

          currentCustomers =
            currentCustomers.map(item =>
              item.id === existing.id
                ? existing
                : item
            );

          result.customersUpdated += 1;

        } else {
          const response =
            await api.post(
              "/renewals/customers",
              payload
            );

          existing =
            response.data;

          currentCustomers.push(
            existing
          );

          result.customersCreated += 1;
        }
      }


      // ========================================================
      // ASSINATURAS
      // ========================================================

      for (
        const importedSubscription
        of backup.subscriptions
      ) {
        const customerPhone =
          String(
            importedSubscription.customerPhone || ""
          ).replace(/\D/g, "");

        const productName =
          String(
            importedSubscription.productName || ""
          ).trim();

        if (
          !customerPhone ||
          !productName ||
          !importedSubscription.dueDate
        ) {
          result.subscriptionsSkipped += 1;
          continue;
        }

        const customer =
          currentCustomers.find(
            item =>
              String(
                item.phone || ""
              ).replace(/\D/g, "") ===
              customerPhone
          );

        const product =
          currentProducts.find(
            item =>
              String(
                item.name || ""
              )
                .trim()
                .toLowerCase() ===
              productName.toLowerCase()
          );

        if (
          !customer ||
          !product
        ) {
          result.subscriptionsSkipped += 1;
          continue;
        }


        // ------------------------------------------------------
        // TENTA LOCALIZAR A CONEXÃO PELO NOME
        // ------------------------------------------------------

        let whatsappId = null;

        const importedWhatsapp =
          importedSubscription.whatsapp || {};

        if (
          importedWhatsapp.name &&
          whatsappConnections.length
        ) {
          const connection =
            whatsappConnections.find(
              item =>
                String(
                  item.name || ""
                )
                  .trim()
                  .toLowerCase() ===
                String(
                  importedWhatsapp.name
                )
                  .trim()
                  .toLowerCase()
            );

          if (connection) {
            whatsappId =
              connection.id;
          }
        }

        /*
         * Se estamos importando na mesma instalação
         * e o ID ainda existe, ele também pode ser usado.
         */
        if (
          !whatsappId &&
          importedWhatsapp.id &&
          whatsappConnections.some(
            item =>
              Number(item.id) ===
              Number(importedWhatsapp.id)
          )
        ) {
          whatsappId =
            importedWhatsapp.id;
        }


        const payload = {
          customerId:
            customer.id,

          productId:
            product.id,

          whatsappId,

          dueDate:
            importedSubscription.dueDate,

          lastPaymentAt:
            importedSubscription.lastPaymentAt || null,

          status:
            importedSubscription.status || "active",

          active:
            importedSubscription.active !== false
        };


        /*
         * Mesma assinatura =
         * mesmo cliente + mesmo produto.
         *
         * Se já existir, reaproveitamos o cadastro.
         */
        let existing =
          currentSubscriptions.find(
            item =>
              Number(
                item.customerId ||
                item.customer?.id
              ) === Number(customer.id) &&
              Number(
                item.productId ||
                item.product?.id
              ) === Number(product.id)
          );

        if (existing) {
          try {
            const response =
              await api.put(
                `/renewals/subscriptions/${existing.id}`,
                payload
              );

            existing =
              response.data;

            currentSubscriptions =
              currentSubscriptions.map(item =>
                item.id === existing.id
                  ? existing
                  : item
              );

            result.subscriptionsUpdated += 1;

          } catch (err) {
            console.error(
              "[RENEWALS] Falha ao atualizar assinatura importada:",
              err
            );

            result.subscriptionsSkipped += 1;
          }

        } else {
          try {
            const response =
              await api.post(
                "/renewals/subscriptions",
                payload
              );

            existing =
              response.data;

            currentSubscriptions.push(
              existing
            );

            result.subscriptionsCreated += 1;

          } catch (err) {
            console.error(
              "[RENEWALS] Falha ao criar assinatura importada:",
              err
            );

            result.subscriptionsSkipped += 1;
          }
        }
      }


      toast.success(
        `Importação concluída. ` +
        `Produtos: ${result.productsCreated} criados / ` +
        `${result.productsUpdated} atualizados. ` +
        `Clientes: ${result.customersCreated} criados / ` +
        `${result.customersUpdated} atualizados. ` +
        `Assinaturas: ${result.subscriptionsCreated} criadas / ` +
        `${result.subscriptionsUpdated} atualizadas / ` +
        `${result.subscriptionsSkipped} ignoradas.`
      );

      /*
       * Recarrega todos os estados da página sem depender
       * do nome interno da função de carregamento.
       */
      setTimeout(() => {
        window.location.reload();
      }, 900);

    } catch (err) {
      console.error(
        "[RENEWALS] Erro ao importar:",
        err
      );

      toast.error(
        err?.response?.data?.error ||
        err?.message ||
        "Não foi possível importar as Renovações."
      );
    }
  };


  const renderCustomers = () => (
    <>
      <div className={classes.toolbar}>
        <div className={classes.toolbarLeft}>
          <TextField
            size="small"
            variant="outlined"
            placeholder="Buscar cliente..."
            value={searchCustomer}
            onChange={event =>
              setSearchCustomer(
                event.target.value
              )
            }
          />
        </div>

        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() =>
            openCustomer(null)
          }
        >
          Novo cliente
        </Button>
      </div>

      <TableContainer component={Paper}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>
                Nome
              </TableCell>

              <TableCell>
                Telefone
              </TableCell>

              <TableCell>
                Observações
              </TableCell>

              <TableCell>
                Status
              </TableCell>

              <TableCell align="right">
                Ações
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredCustomers.map(customer => (
              <TableRow key={customer.id}>
                <TableCell>
                  {customer.name}
                </TableCell>

                <TableCell>
                  {customer.phone}
                </TableCell>

                <TableCell>
                  {customer.notes || "—"}
                </TableCell>

                <TableCell>
                  <Chip
                    size="small"
                    label={
                      customer.active
                        ? "Ativo"
                        : "Inativo"
                    }
                  />
                </TableCell>

                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton
                      size="small"
                      onClick={() =>
                        openCustomer(customer)
                      }
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>

                  {(
                    <Tooltip title="Excluir definitivamente">
                      <IconButton
                        size="small"
                        onClick={() =>
                          deactivateCustomer(
                            customer
                          )
                        }
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {!filteredCustomers.length && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className={classes.empty}
                >
                  Nenhum cliente cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );


  const renderProducts = () => (
    <>
      <div className={classes.toolbar}>
        <div className={classes.toolbarLeft}>
          <TextField
            size="small"
            variant="outlined"
            placeholder="Buscar produto..."
            value={searchProduct}
            onChange={event =>
              setSearchProduct(
                event.target.value
              )
            }
          />
        </div>

        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() =>
            openProduct(null)
          }
        >
          Novo produto
        </Button>
      </div>

      <TableContainer component={Paper}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>
                Produto
              </TableCell>

              <TableCell>
                Valor
              </TableCell>

              <TableCell>
                Regra
              </TableCell>

              <TableCell>
                Renovação
              </TableCell>

              <TableCell>
                Status
              </TableCell>

              <TableCell align="right">
                Ações
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredProducts.map(product => (
              <TableRow key={product.id}>
                <TableCell>
                  <strong>
                    {product.name}
                  </strong>

                  {product.description && (
                    <Typography
                      variant="caption"
                      display="block"
                      color="textSecondary"
                    >
                      {product.description}
                    </Typography>
                  )}
                </TableCell>

                <TableCell>
                  {formatMoney(product.amount)}
                </TableCell>

                <TableCell>
                  {product.dueRule ===
                  "fixed_day"
                    ? `Dia ${product.fixedDay} de cada mês`
                    : `${product.runningDays} dias corridos`}
                </TableCell>

                <TableCell>
                  {product.renewFrom ===
                  "payment_date"
                    ? "A partir do pagamento"
                    : "A partir do vencimento"}
                </TableCell>

                <TableCell>
                  <Chip
                    size="small"
                    label={
                      product.active
                        ? "Ativo"
                        : "Inativo"
                    }
                  />
                </TableCell>

                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton
                      size="small"
                      onClick={() =>
                        openProduct(product)
                      }
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>

                  {(
                    <Tooltip title="Excluir definitivamente">
                      <IconButton
                        size="small"
                        onClick={() =>
                          deactivateProduct(
                            product
                          )
                        }
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {!filteredProducts.length && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className={classes.empty}
                >
                  Nenhum produto cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );


  const renderSubscriptions = () => (
    <>
      <div className={classes.toolbar}>
        <div className={classes.toolbarLeft}>
          <TextField
            size="small"
            variant="outlined"
            placeholder="Buscar assinatura..."
            value={searchSubscription}
            onChange={event =>
              setSearchSubscription(
                event.target.value
              )
            }
          />
        </div>

        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() =>
            openSubscription(null)
          }
        >
          Nova assinatura
        </Button>
      </div>

      <TableContainer component={Paper}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>
                Cliente
              </TableCell>

              <TableCell>
                Produto
              </TableCell>

              <TableCell>
                Conexão
              </TableCell>

              <TableCell>
                Vencimento
              </TableCell>

              <TableCell>
                Situação
              </TableCell>

              <TableCell>
                Valor
              </TableCell>

              <TableCell align="right">
                Ações
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredSubscriptions.map(
              subscription => {
                const status =
                  dueLabel(
                    subscription.dueDate
                  );

                return (
                  <TableRow
                    key={subscription.id}
                  >
                    <TableCell>
                      <strong>
                        {subscription.customer
                          ?.name || "—"}
                      </strong>

                      <Typography
                        variant="caption"
                        display="block"
                        color="textSecondary"
                      >
                        {subscription.customer
                          ?.phone || ""}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      {subscription.product
                        ?.name || "—"}
                    </TableCell>

                    <TableCell>
                      {subscription.whatsapp
                        ?.name || "Padrão"}
                    </TableCell>

                    <TableCell>
                      {formatDate(
                        subscription.dueDate
                      )}
                    </TableCell>

                    <TableCell>
                      {subscription.status ===
                      "canceled" ? (
                        <Chip
                          size="small"
                          label="Cancelada"
                        />
                      ) : (
                        <Chip
                          size="small"
                          label={status.text}
                          color={status.color}
                        />
                      )}
                    </TableCell>

                    <TableCell>
                      {formatMoney(
                        subscription.product
                          ?.amount
                      )}
                    </TableCell>

                    <TableCell align="right">
                      {subscription.status !==
                        "canceled" &&
                        subscription.active !==
                          false && (
                          <Tooltip title="Dar baixa">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() =>
                                openRenew(
                                  subscription
                                )
                              }
                            >
                              <PaymentIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() =>
                            openSubscription(
                              subscription
                            )
                          }
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>

                      {(
                        <Tooltip title="Excluir definitivamente">
                          <IconButton
                            size="small"
                            onClick={() =>
                              cancelSubscription(
                                subscription
                              )
                            }
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              }
            )}

            {!filteredSubscriptions.length && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className={classes.empty}
                >
                  Nenhuma assinatura cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );


  const renderFailures = () => (
    <>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
      >
        <div>
          <Typography variant="h6">
            Falhas de envio
          </Typography>

          <Typography
            variant="body2"
            color="textSecondary"
          >
            Acompanhe falhas, retries automáticos e notificações em processamento.
          </Typography>
        </div>

        <Chip
          label={`${failures.length} ocorrência${failures.length === 1 ? "" : "s"}`}
          color={
            failures.some(
              item => item.status === "failed"
            )
              ? "secondary"
              : "default"
          }
        />
      </Box>

      <TableContainer component={Paper}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>
                Cliente
              </TableCell>

              <TableCell>
                Produto
              </TableCell>

              <TableCell>
                Vencimento
              </TableCell>

              <TableCell>
                Status
              </TableCell>

              <TableCell>
                Tentativas
              </TableCell>

              <TableCell>
                Última tentativa
              </TableCell>

              <TableCell>
                Próxima tentativa
              </TableCell>

              <TableCell>
                Erro
              </TableCell>

              <TableCell align="right">
                Ações
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {failures.map(notification => {
              const subscription =
                notification.subscription || {};

              const customer =
                subscription.customer || {};

              const product =
                subscription.product || {};

              const statusLabel =
                notification.status === "failed"
                  ? "Falha definitiva"
                  : notification.status === "processing"
                    ? "Processando"
                    : "Aguardando retry";

              const statusColor =
                notification.status === "failed"
                  ? "secondary"
                  : notification.status === "processing"
                    ? "primary"
                    : "default";

              return (
                <TableRow key={notification.id}>
                  <TableCell>
                    {customer.name || "—"}
                  </TableCell>

                  <TableCell>
                    {product.name || "—"}
                  </TableCell>

                  <TableCell>
                    {formatDate(
                      notification.cycleDueDate
                    )}
                  </TableCell>

                  <TableCell>
                    <Chip
                      size="small"
                      label={statusLabel}
                      color={statusColor}
                    />
                  </TableCell>

                  <TableCell>
                    {Number(
                      notification.attempts || 0
                    )}
                    {" / "}
                    {Number(
                      notification.maxAttempts || 3
                    )}
                  </TableCell>

                  <TableCell>
                    {notification.lastAttemptAt
                      ? new Date(
                          notification.lastAttemptAt
                        ).toLocaleString(
                          "pt-BR"
                        )
                      : "—"}
                  </TableCell>

                  <TableCell>
                    {notification.nextAttemptAt
                      ? new Date(
                          notification.nextAttemptAt
                        ).toLocaleString(
                          "pt-BR"
                        )
                      : "—"}
                  </TableCell>

                  <TableCell
                    style={{
                      maxWidth: 300,
                      whiteSpace: "normal",
                      wordBreak: "break-word"
                    }}
                  >
                    {notification.errorMessage || "—"}
                  </TableCell>

                  <TableCell align="right">
                    {notification.status !==
                      "processing" && (
                      <Tooltip title="Reenviar agora">
                        <span>
                          <IconButton
                            size="small"
                            disabled={saving}
                            onClick={() =>
                              retryFailureNow(
                                notification
                              )
                            }
                          >
                            <ReplayIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}

                    <Tooltip title="Cancelar tentativa">
                      <span>
                        <IconButton
                          size="small"
                          disabled={saving}
                          onClick={() =>
                            cancelFailure(
                              notification
                            )
                          }
                        >
                          <DeleteIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}

            {!failures.length && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className={classes.empty}
                >
                  Nenhuma falha de envio registrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );


  const renderHistory = () => (
    <TableContainer component={Paper}>
      <Table className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>
              Data
            </TableCell>

            <TableCell>
              Cliente
            </TableCell>

            <TableCell>
              Produto
            </TableCell>

            <TableCell>
              Vencimento anterior
            </TableCell>

            <TableCell>
              Próximo vencimento
            </TableCell>

            <TableCell align="right">
              Valor
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {payments.map(payment => (
            <TableRow key={payment.id}>
              <TableCell>
                {payment.paidAt
                  ? new Date(
                      payment.paidAt
                    ).toLocaleString(
                      "pt-BR"
                    )
                  : "—"}
              </TableCell>

              <TableCell>
                {payment.customer?.name ||
                  "—"}
              </TableCell>

              <TableCell>
                {payment.product?.name ||
                  "—"}
              </TableCell>

              <TableCell>
                {formatDate(
                  payment.previousDueDate
                )}
              </TableCell>

              <TableCell>
                {formatDate(
                  payment.nextDueDate
                )}
              </TableCell>

              <TableCell align="right">
                {formatMoney(
                  payment.amount
                )}
              </TableCell>
            </TableRow>
          ))}

          {!payments.length && (
            <TableRow>
              <TableCell
                colSpan={6}
                className={classes.empty}
              >
                Nenhum pagamento registrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );


  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
        >
          <div>
            <Typography
              variant="h5"
              className={classes.title}
            >
              Renovações
            </Typography>

            <Typography
              variant="body2"
              className={classes.subtitle}
            >
              Controle vencimentos, cobranças,
              pagamentos e renovações automáticas.
            </Typography>
          </div>

          <Tooltip title="Atualizar">
            <IconButton
              onClick={loadData}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </div>

      <Paper className={classes.tabs}>
        <Tabs
          value={tab}
          onChange={(event, value) =>
            setTab(value)
          }
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Visão Geral" />
          <Tab label="Clientes" />
          <Tab label="Produtos" />
          <Tab label="Assinaturas" />
          <Tab label="Histórico" />
          <Tab
            label={
              failures.length
                ? `Falhas de envio (${failures.length})`
                : "Falhas de envio"
            }
          />
        </Tabs>

        <Box
          display="flex"
          justifyContent="flex-end"
          alignItems="center"
          flexWrap="wrap"
          style={{
            gap: 8,
            marginBottom: 16
          }}
        >
          <Button
            variant="outlined"
            component="label"
          >
            Importar configurações

            <input
              type="file"
              accept=".json,application/json"
              style={{
                display: "none"
              }}
              onChange={
                handleImportRenewals
              }
            />
          </Button>

          <Button
            variant="outlined"
            color="primary"
            onClick={
              handleExportRenewals
            }
          >
            Exportar configurações
          </Button>
        </Box>

      </Paper>

      {loading ? (
        <Box
          display="flex"
          justifyContent="center"
          p={6}
        >
          <CircularProgress />
        </Box>
      ) : (
        <>
          {tab === 0 &&
            renderOverview()}

          {tab === 1 &&
            renderCustomers()}

          {tab === 2 &&
            renderProducts()}

          {tab === 3 &&
            renderSubscriptions()}

          {tab === 4 &&
            renderHistory()}

          {tab === 5 &&
            renderFailures()}
        </>
      )}


      {/* PRODUTO */}
      <Dialog
        open={productModal}
        onClose={() =>
          setProductModal(false)
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {productEditing
            ? "Editar produto"
            : "Novo produto"}
        </DialogTitle>

        <DialogContent>
          <TextField
            fullWidth
            variant="outlined"
            label="Nome"
            className={classes.dialogField}
            value={productForm.name}
            onChange={event =>
              setProductForm({
                ...productForm,
                name: event.target.value
              })
            }
          />

          <TextField
            fullWidth
            variant="outlined"
            label="Descrição"
            multiline
            rows={2}
            className={classes.dialogField}
            value={productForm.description}
            onChange={event =>
              setProductForm({
                ...productForm,
                description:
                  event.target.value
              })
            }
          />

          <TextField
            fullWidth
            variant="outlined"
            type="number"
            label="Valor"
            className={classes.dialogField}
            value={productForm.amount}
            onChange={event =>
              setProductForm({
                ...productForm,
                amount: event.target.value
              })
            }
          />

          <FormControl
            fullWidth
            variant="outlined"
            className={classes.dialogField}
          >
            <InputLabel>
              Tipo de vencimento
            </InputLabel>

            <Select
              value={productForm.dueRule}
              onChange={event => {
                const dueRule =
                  event.target.value;

                setProductForm({
                  ...productForm,
                  dueRule,
                  renewFrom:
                    dueRule === "fixed_day"
                      ? "due_date"
                      : productForm.renewFrom
                });
              }}
              label="Tipo de vencimento"
            >
              <MenuItem value="running_days">
                Dias corridos
              </MenuItem>

              <MenuItem value="fixed_day">
                Dia fixo do mês
              </MenuItem>
            </Select>
          </FormControl>

          {productForm.dueRule ===
          "running_days" ? (
            <TextField
              fullWidth
              variant="outlined"
              type="number"
              label="Quantidade de dias"
              className={classes.dialogField}
              value={
                productForm.runningDays
              }
              onChange={event =>
                setProductForm({
                  ...productForm,
                  runningDays:
                    event.target.value
                })
              }
            />
          ) : (
            <TextField
              fullWidth
              variant="outlined"
              type="number"
              label="Dia fixo do mês"
              inputProps={{
                min: 1,
                max: 31
              }}
              className={classes.dialogField}
              value={productForm.fixedDay}
              onChange={event =>
                setProductForm({
                  ...productForm,
                  fixedDay:
                    event.target.value
                })
              }
            />
          )}

          {productForm.dueRule === "running_days" && (
            <FormControl
              fullWidth
              variant="outlined"
              className={classes.dialogField}
            >
              <InputLabel>
                Renovar contando de
              </InputLabel>

              <Select
                value={
                  productForm.renewFrom
                }
                onChange={event =>
                  setProductForm({
                    ...productForm,
                    renewFrom:
                      event.target.value
                  })
                }
                label="Renovar contando de"
              >
                <MenuItem value="due_date">
                  Vencimento atual
                </MenuItem>

                <MenuItem value="payment_date">
                  Data do pagamento
                </MenuItem>
              </Select>
            </FormControl>
          )}

          <div className={classes.reminderBox}>
            <Typography
              variant="subtitle2"
              gutterBottom
            >
              Régua de lembretes
            </Typography>

            {reminderOptions.map(
              option => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox
                      color="primary"
                      checked={productForm.reminderDays.includes(
                        option.value
                      )}
                      onChange={() =>
                        toggleReminder(
                          option.value
                        )
                      }
                    />
                  }
                  label={option.label}
                />
              )
            )}
          </div>

          <TextField
            fullWidth
            variant="outlined"
            type="time"
            label="Horário de envio dos lembretes"
            InputLabelProps={{
              shrink: true
            }}
            inputProps={{
              step: 300
            }}
            className={classes.dialogField}
            value={
              productForm.reminderTime || "09:00"
            }
            onChange={event =>
              setProductForm({
                ...productForm,
                reminderTime:
                  event.target.value
              })
            }
            helperText="Horário de Brasília. Ao salvar, os lembretes pendentes serão atualizados."
          />

          <Box
            mt={2}
            mb={2}
            p={2}
            border={1}
            borderColor="divider"
            borderRadius={8}
          >
            <Typography
              variant="subtitle1"
              style={{
                fontWeight: 600,
                marginBottom: 6
              }}
            >
              Mensagens automáticas
            </Typography>

            <Typography
              variant="caption"
              color="textSecondary"
              display="block"
              style={{ marginBottom: 16 }}
            >
              Variáveis disponíveis: {"{{nome}}"}, {"{{produto}}"}, {"{{valor}}"}, {"{{vencimento}}"} e {"{{proximoVencimento}}"}.
              Se deixar uma mensagem vazia, o texto padrão do sistema será utilizado.
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              label="3 dias antes"
              className={classes.dialogField}
              value={
                productForm.messageTemplates?.["3"] || ""
              }
              onChange={event =>
                updateMessageTemplate(
                  "3",
                  event.target.value
                )
              }
              placeholder="Olá, {{nome}}! Seu {{produto}} vence em 3 dias..."
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              label="2 dias antes"
              className={classes.dialogField}
              value={
                productForm.messageTemplates?.["2"] || ""
              }
              onChange={event =>
                updateMessageTemplate(
                  "2",
                  event.target.value
                )
              }
              placeholder="Olá, {{nome}}! Seu {{produto}} vence em 2 dias..."
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              label="1 dia antes"
              className={classes.dialogField}
              value={
                productForm.messageTemplates?.["1"] || ""
              }
              onChange={event =>
                updateMessageTemplate(
                  "1",
                  event.target.value
                )
              }
              placeholder="Olá, {{nome}}! Seu {{produto}} vence amanhã..."
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              label="No dia do vencimento"
              className={classes.dialogField}
              value={
                productForm.messageTemplates?.["0"] || ""
              }
              onChange={event =>
                updateMessageTemplate(
                  "0",
                  event.target.value
                )
              }
              placeholder="Olá, {{nome}}! Seu {{produto}} vence hoje..."
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              label="1 dia após o vencimento"
              className={classes.dialogField}
              value={
                productForm.messageTemplates?.["-1"] || ""
              }
              onChange={event =>
                updateMessageTemplate(
                  "-1",
                  event.target.value
                )
              }
              placeholder="Olá, {{nome}}! Seu {{produto}} venceu ontem..."
            />

            <TextField
              fullWidth
              multiline
              rows={4}
              variant="outlined"
              label="Confirmação de pagamento"
              className={classes.dialogField}
              value={
                productForm.messageTemplates?.paymentConfirmation || ""
              }
              onChange={event =>
                updateMessageTemplate(
                  "paymentConfirmation",
                  event.target.value
                )
              }
              placeholder={"Olá, {{nome}}! Pagamento confirmado. Próximo vencimento: {{proximoVencimento}}"}
            />
          </Box>

          <FormControlLabel
            control={
              <Switch
                color="primary"
                checked={
                  productForm.active
                }
                onChange={event =>
                  setProductForm({
                    ...productForm,
                    active:
                      event.target.checked
                  })
                }
              />
            }
            label="Produto ativo"
          />
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() =>
              setProductModal(false)
            }
          >
            Cancelar
          </Button>

          <Button
            color="primary"
            variant="contained"
            disabled={saving}
            onClick={saveProduct}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>


      {/* CLIENTE */}
      <Dialog
        open={customerModal}
        onClose={() =>
          setCustomerModal(false)
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {customerEditing
            ? "Editar cliente"
            : "Novo cliente"}
        </DialogTitle>

        <DialogContent>
          <TextField
            fullWidth
            variant="outlined"
            label="Nome"
            className={classes.dialogField}
            value={customerForm.name}
            onChange={event =>
              setCustomerForm({
                ...customerForm,
                name: event.target.value
              })
            }
          />

          <TextField
            fullWidth
            variant="outlined"
            label="WhatsApp"
            placeholder="5511999999999"
            className={classes.dialogField}
            value={customerForm.phone}
            onChange={event =>
              setCustomerForm({
                ...customerForm,
                phone: event.target.value
              })
            }
          />

          <TextField
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            label="Observações"
            className={classes.dialogField}
            value={customerForm.notes}
            onChange={event =>
              setCustomerForm({
                ...customerForm,
                notes: event.target.value
              })
            }
          />

          <FormControlLabel
            control={
              <Switch
                color="primary"
                checked={
                  customerForm.active
                }
                onChange={event =>
                  setCustomerForm({
                    ...customerForm,
                    active:
                      event.target.checked
                  })
                }
              />
            }
            label="Cliente ativo"
          />
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() =>
              setCustomerModal(false)
            }
          >
            Cancelar
          </Button>

          <Button
            color="primary"
            variant="contained"
            disabled={saving}
            onClick={saveCustomer}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>


      {/* ASSINATURA */}
      <Dialog
        open={subscriptionModal}
        onClose={() =>
          setSubscriptionModal(false)
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {subscriptionEditing
            ? "Editar assinatura"
            : "Nova assinatura"}
        </DialogTitle>

        <DialogContent>
          <FormControl
            fullWidth
            variant="outlined"
            className={classes.dialogField}
          >
            <InputLabel>
              Cliente
            </InputLabel>

            <Select
              value={
                subscriptionForm.customerId
              }
              onChange={event =>
                setSubscriptionForm({
                  ...subscriptionForm,
                  customerId:
                    event.target.value
                })
              }
              label="Cliente"
            >
              {customers
                .filter(item => item.active)
                .map(customer => (
                  <MenuItem
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.name} —{" "}
                    {customer.phone}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          <FormControl
            fullWidth
            variant="outlined"
            className={classes.dialogField}
          >
            <InputLabel>
              Produto
            </InputLabel>

            <Select
              value={
                subscriptionForm.productId
              }
              onChange={event =>
                setSubscriptionForm({
                  ...subscriptionForm,
                  productId:
                    event.target.value
                })
              }
              label="Produto"
            >
              {products
                .filter(item => item.active)
                .map(product => (
                  <MenuItem
                    key={product.id}
                    value={product.id}
                  >
                    {product.name} —{" "}
                    {formatMoney(
                      product.amount
                    )}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          <FormControl
            fullWidth
            variant="outlined"
            className={classes.dialogField}
          >
            <InputLabel>
              Conexão WhatsApp
            </InputLabel>

            <Select
              value={
                subscriptionForm.whatsappId
              }
              onChange={event =>
                setSubscriptionForm({
                  ...subscriptionForm,
                  whatsappId:
                    event.target.value
                })
              }
              label="Conexão WhatsApp"
            >
              <MenuItem value="">
                Usar conexão padrão
              </MenuItem>

              {whatsapps.map(whatsapp => (
                <MenuItem
                  key={whatsapp.id}
                  value={whatsapp.id}
                >
                  {whatsapp.name}
                  {whatsapp.channel
                    ? ` — ${whatsapp.channel}`
                    : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            variant="outlined"
            type="date"
            label="Primeiro vencimento"
            InputLabelProps={{
              shrink: true
            }}
            className={classes.dialogField}
            value={
              subscriptionForm.dueDate
            }
            onChange={event =>
              setSubscriptionForm({
                ...subscriptionForm,
                dueDate:
                  event.target.value
              })
            }
          />
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() =>
              setSubscriptionModal(false)
            }
          >
            Cancelar
          </Button>

          <Button
            color="primary"
            variant="contained"
            disabled={saving}
            onClick={saveSubscription}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>


      {/* DAR BAIXA */}
      <Dialog
        open={renewModal}
        onClose={() =>
          setRenewModal(false)
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Dar baixa / Renovar
        </DialogTitle>

        <DialogContent>
          {renewSubscription && (
            <>
              <Typography>
                <strong>Cliente:</strong>{" "}
                {renewSubscription.customer
                  ?.name}
              </Typography>

              <Typography>
                <strong>Produto:</strong>{" "}
                {renewSubscription.product
                  ?.name}
              </Typography>

              <Typography>
                <strong>
                  Vencimento atual:
                </strong>{" "}
                {formatDate(
                  renewSubscription.dueDate
                )}
              </Typography>

              <TextField
                fullWidth
                type="date"
                variant="outlined"
                label="Data do pagamento"
                InputLabelProps={{
                  shrink: true
                }}
                className={
                  classes.dialogField
                }
                value={
                  renewForm.paymentDate
                }
                onChange={event => {
                  const paymentDate =
                    event.target.value;

                  setRenewForm({
                    ...renewForm,
                    paymentDate
                  });

                  loadRenewPreview(
                    renewSubscription,
                    paymentDate
                  );
                }}
              />

              <TextField
                fullWidth
                type="number"
                variant="outlined"
                label="Valor recebido"
                className={
                  classes.dialogField
                }
                value={renewForm.amount}
                onChange={event =>
                  setRenewForm({
                    ...renewForm,
                    amount:
                      event.target.value
                  })
                }
              />

              <TextField
                fullWidth
                multiline
                rows={2}
                variant="outlined"
                label="Observação"
                placeholder="Ex.: PIX"
                className={
                  classes.dialogField
                }
                value={renewForm.notes}
                onChange={event =>
                  setRenewForm({
                    ...renewForm,
                    notes:
                      event.target.value
                  })
                }
              />

              <div
                className={
                  classes.nextDue
                }
              >
                <Typography
                  variant="body2"
                  color="textSecondary"
                >
                  Próximo vencimento
                </Typography>

                <Typography
                  variant="h6"
                >
                  {nextDuePreview
                    ?.nextDueDate
                    ? formatDate(
                        nextDuePreview.nextDueDate
                      )
                    : "Calculando..."}
                </Typography>
              </div>
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() =>
              setRenewModal(false)
            }
          >
            Cancelar
          </Button>

          <Button
            color="primary"
            variant="contained"
            startIcon={<PaymentIcon />}
            disabled={
              saving ||
              !renewForm.paymentDate
            }
            onClick={saveRenew}
          >
            Confirmar baixa
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Renewals;
