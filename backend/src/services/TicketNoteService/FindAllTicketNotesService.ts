import TicketNote from "../../models/TicketNote";
import Ticket from "../../models/Ticket";

const FindAllTicketNotesService = async (companyId: number): Promise<TicketNote[]> => {
  const ticketNotes = await TicketNote.findAll({
    include: [
      {
        model: Ticket,
        as: "ticket",
        where: { companyId },
        attributes: []
      }
    ]
  });
  return ticketNotes;
};

export default FindAllTicketNotesService;
